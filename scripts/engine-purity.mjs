// Fails if anything under src/game/{engine,data} or src/game/types.ts reaches for React or the
// browser. Those files have to run unchanged inside a Node server (MULTIPLAYER_PLAN §4) — that is
// what makes the multiplayer conversion a transport change rather than a rules change.
//
// This is the real deliverable of the extraction: the guarantee, checked on every run, rather than
// a one-time inspection that quietly stops being true three commits later. Moving the files into
// their own package (Wave 3) is then mechanical.
//
// Run: npm run engine-purity
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src/game/engine', 'src/game/data']
const FILES = ['src/game/types.ts']

// Bare browser/React globals the engine must never touch. `crypto` and `Date` are deliberately
// absent — both exist in Node 18+ and the engine's determinism already depends on them.
const BANNED_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'alert(']
const BANNED_IMPORTS = [/from\s+['"]react/, /from\s+['"]zustand/, /from\s+['"]\.\.\/\.\.\/\.\.\/components/, /from\s+['"].*\/state\/store/]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p)
  }
  return out
}

// Strip comments and string literals so a global named in prose or in a message can't trip the scan.
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

const files = [...ROOTS.flatMap(walk), ...FILES]
const violations = []

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const code = strip(raw)
  for (const pattern of BANNED_IMPORTS) {
    if (pattern.test(code)) violations.push({ file, what: `imports ${pattern.source}` })
  }
  for (const g of BANNED_GLOBALS) {
    const re = new RegExp(`(^|[^.\\w])${g.replace('(', '\\(')}`, 'm')
    if (re.test(code)) violations.push({ file, what: `uses \`${g}\`` })
  }
  if (file.endsWith('.tsx')) violations.push({ file, what: 'is a .tsx file — engine code must not contain JSX' })
}

if (violations.length > 0) {
  console.error(`\nEngine purity FAILED — ${violations.length} violation(s):\n`)
  for (const v of violations) console.error(`  ${relative(process.cwd(), v.file)}  ${v.what}`)
  console.error('\nEngine and data must stay runnable in Node. Move browser/React code to components/.\n')
  process.exit(1)
}

console.log(`Engine purity OK — ${files.length} files, no React/DOM dependencies.`)
