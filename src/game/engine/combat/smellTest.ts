/**
 * Combat simulation smell-test (Combat Polishing Phase 10) — the reusable seeded
 * harness, run ONCE at the end of all combat work, never shipped in the game
 * bundle. It answers two questions the plan cares about:
 *
 *   (a) Balance: is the win curve sane and monotonic across the power band, and
 *       do draws (Phase 9) concentrate in close fights and vanish in blowouts
 *       (the legibility guard — a decisive winner should never flee)?
 *   (b) Dual-resolver agreement (invariant §4.7 #3): the full narrative resolver
 *       and the fast outcome-only resolver must still decide winners the same way.
 *       Since only the full resolver can DRAW, they are compared on the win rate
 *       AMONG DECISIVE fights — that conditional rate is what must match.
 *
 * Run:  npm run smell-test              — the statistical balance sweep + verdicts
 *       npm run smell-test -- reports   — print a few full sample battle narratives
 *
 * Everything is seeded (mulberry32), so the whole report is deterministic and
 * reproducible run-to-run — no Math.random anywhere in the sampled path.
 */
import { pathToFileURL } from 'node:url'
import { DISCIPLE_TEMPERAMENTS, type BattleTerrain, type CombatTrait } from '../../types'
import { hashString, mulberry32 } from '../rng'
import { TRAIT_EFFECTS } from '../combatPower'
import { rollWoundDamage } from '../injury'
import {
  getAdvantageBand,
  getOutcomeTier,
  resolveBattle,
  resolveBattleOutcomeOnly,
  TERRAIN_EFFECTS,
  TIER_LABEL,
  type BattleNarrative,
  type BattleParticipant,
} from './battleSimulator'

const TRIALS = 20_000
/** Power ratios spanning the interesting band, from a defender-favoured rout to a decisive attacker win (the resolver fixes the winner past ±1.75×). */
const RATIOS = [0.4, 0.6, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.5]
const DEFENDER_POWER = 1000
const ROSTER = 5

function roster(prefix: string, n: number): BattleParticipant[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `${prefix}${i}` }))
}

/** A well-spread deterministic seed per (matchup, trial), so distinct trials draw distinct fights. */
function trialSeed(tag: number, trial: number): number {
  return hashString(`smell:${tag}:${trial}`) >>> 0
}

interface Tally {
  win: number
  draw: number
  loss: number
  attackerWounds: number
  defenderWounds: number
  /** Total HP damage dealt across all wounds, as a % of max HP — the magnitude the HP pool cares about (HEALTH_SYSTEM_PLAN Phase 1). */
  woundDamagePct: number
  /** Wounds whose scaled damage would floor a FULL-HP disciple to 0 in a single hit — the would-be-down count that feeds the downed roll (Phase 5). */
  downsFromFull: number
  /** Full resolver's odds-only winner, BEFORE the player-facing retreat layer — the head-to-head with the background resolver. */
  oddsWin: number
  bgWin: number
}

function sample(attackerPower: number, defenderPower: number, tag: number, defenderTrait?: CombatTrait): Tally {
  const t: Tally = { win: 0, draw: 0, loss: 0, attackerWounds: 0, defenderWounds: 0, woundDamagePct: 0, downsFromFull: 0, oddsWin: 0, bgWin: 0 }
  const attackers = roster('A', ROSTER)
  const defenders = roster('D', ROSTER)
  for (let i = 0; i < TRIALS; i++) {
    const seed = trialSeed(tag, i)
    const { outcome } = resolveBattle({
      seed,
      attackerPower,
      defenderPower,
      attackerParticipants: attackers,
      defenderParticipants: defenders,
      defenderLeaderId: defenderTrait ? defenders[0].id : undefined,
      defenderLeaderTrait: defenderTrait,
      defenderName: 'D',
    })
    if (outcome.drawn) t.draw++
    else if (outcome.won) t.win++
    else t.loss++
    if (outcome.oddsWon) t.oddsWin++
    for (const w of outcome.wounds) {
      const isAttacker = w.discipleId[0] === 'A'
      if (isAttacker) t.attackerWounds++
      else t.defenderWounds++
      // Mirror the real application: seeded per (battle, disciple), scaled by the DEALER's power over the wounded side's (Phase 4).
      const powerRatio = isAttacker ? defenderPower / attackerPower : attackerPower / defenderPower
      const dmg = rollWoundDamage(w.severity, mulberry32((seed ^ hashString(w.discipleId)) >>> 0), powerRatio)
      t.woundDamagePct += dmg * 100
      if (dmg >= 1) t.downsFromFull++ // a single hit that would floor a full-HP disciple → a would-be down (then a ~5% death fate roll).
    }
    // Same seed into the fast resolver — its win rate must match the full resolver's ODDS-ONLY rate (both are just `rng < winProbability`); the retreat layer then reshapes the full distribution on top, which is expected and player-facing only.
    if (resolveBattleOutcomeOnly(seed, attackerPower, defenderPower).won) t.bgWin++
  }
  return t
}

const pct = (n: number, d = TRIALS): string => `${((100 * n) / d).toFixed(1)}%`.padStart(6)

function runBalanceSweep(): { maxAgreementDelta: number; monotonic: boolean; drawAtEven: number; drawAtExtreme: number } {
  console.log(`\n=== Balance sweep (${TRIALS.toLocaleString('en-US')} trials/matchup, defenderPower ${DEFENDER_POWER}, ${ROSTER}v${ROSTER}) ===`)
  console.log('       full resolver (with retreat)  | odds-only |')
  console.log('ratio |  win     draw    loss         | full   bg | agreeΔ | avg wounds A/D | avg dmg%/wound | down-from-full')
  let maxAgreementDelta = 0
  let monotonic = true
  let prevWin = -1
  let drawAtEven = 0
  let drawAtExtreme = 0
  RATIOS.forEach((ratio, idx) => {
    const t = sample(Math.round(DEFENDER_POWER * ratio), DEFENDER_POWER, idx)
    // Agreement is base-odds only: the full resolver's pre-retreat winner vs the fast resolver. The retreat layer's reshaping of the FULL win/draw/loss is expected and not part of this check.
    const oddsWin = t.oddsWin / TRIALS
    const bgWin = t.bgWin / TRIALS
    const agree = Math.abs(bgWin - oddsWin)
    maxAgreementDelta = Math.max(maxAgreementDelta, agree)
    const winRate = t.win / TRIALS
    if (winRate < prevWin - 0.005) monotonic = false
    prevWin = winRate
    if (ratio === 1.0) drawAtEven = t.draw / TRIALS
    if (ratio === RATIOS[0] || ratio === RATIOS[RATIOS.length - 1]) drawAtExtreme = Math.max(drawAtExtreme, t.draw / TRIALS)
    const totalWounds = t.attackerWounds + t.defenderWounds
    const avgDmgPerWound = totalWounds > 0 ? t.woundDamagePct / totalWounds : 0
    const downFromFullRate = totalWounds > 0 ? (100 * t.downsFromFull) / totalWounds : 0
    console.log(
      `${ratio.toFixed(2).padStart(5)} | ${pct(t.win)} ${pct(t.draw)} ${pct(t.loss)}        | ${pct(t.oddsWin)} ${pct(t.bgWin)} | ${(100 * agree).toFixed(2).padStart(5)}% | ${(t.attackerWounds / TRIALS).toFixed(2)}/${(t.defenderWounds / TRIALS).toFixed(2)}       | ${avgDmgPerWound.toFixed(1)}%          | ${downFromFullRate.toFixed(1)}% of wounds`,
    )
  })
  return { maxAgreementDelta, monotonic, drawAtEven, drawAtExtreme }
}

/** At even power, sweep the defending leader's trait to confirm retreatBias (Phase 9) shifts draw/loss the intended direction: cautious/defensive draw & survive more, aggressive/ruthless less. */
function runTraitSweep(): void {
  console.log(`\n=== Defender-leader trait sweep @ even power (ratio 1.0, ${TRIALS.toLocaleString('en-US')} trials) ===`)
  console.log('trait      | retreatBias | full-win(atk)  draw   defender-holds | avg def wounds')
  const traits: (CombatTrait | undefined)[] = [undefined, 'aggressive', 'ruthless', 'inspiring', 'defensive', 'cautious']
  traits.forEach((trait, i) => {
    const t = sample(DEFENDER_POWER, DEFENDER_POWER, 1000 + i, trait)
    const holds = t.loss + t.draw // from the DEFENDER's view, a draw or an attacker-loss both mean the seat is held
    const bias = trait ? TRAIT_EFFECTS[trait].retreatBias : 0
    console.log(
      `${(trait ?? 'none').padEnd(10)} | ${bias.toFixed(2).padStart(11)} | ${pct(t.win)}       ${pct(t.draw)}  ${pct(holds).padStart(6)}         | ${(t.defenderWounds / TRIALS).toFixed(2)}`,
    )
  })
}

/** Same seed → identical outcome (the property BattleReportView relies on to regenerate a stored fight). */
function checkDeterminism(): boolean {
  const seed = trialSeed(99, 7)
  const params = {
    seed,
    attackerPower: 1100,
    defenderPower: 1000,
    attackerParticipants: roster('A', ROSTER),
    defenderParticipants: roster('D', ROSTER),
    defenderName: 'D',
  }
  const a = resolveBattle(params)
  const b = resolveBattle(params)
  return (
    a.outcome.won === b.outcome.won &&
    a.outcome.drawn === b.outcome.drawn &&
    a.outcome.wounds.length === b.outcome.wounds.length &&
    a.events.map((e) => e.text).join('|') === b.events.map((e) => e.text).join('|')
  )
}

// --- Sample battle narratives (npm run smell-test -- reports). Prints the full regenerated `events` for one fight of each terminal state, exactly as BattleReportView would render it.

const PLAYER_SQUAD = ['Elder Zhao Yun', 'Su Lian', 'Bao Feng', 'Little Mei', 'Han Xu']

interface Scenario {
  title: string
  side: 'attack' | 'defense'
  /** Player squad's power vs the enemy's — framed from the player side; the finder maps it onto attacker/defender by `side`. */
  playerPower: number
  enemyPower: number
  playerTrait?: CombatTrait
  terrain?: BattleTerrain
  /** NPC label — the defender's façade on an attack, the attacker's name on a defense. */
  enemyName: string
  want: (o: BattleNarrative['outcome']) => boolean
}

/** Builds the resolveBattle params for a scenario+seed, in the same shape the real caller (expeditions.ts on attack, npcSimulation.ts on defense) uses. */
function scenarioParams(s: Scenario, seed: number) {
  // Each demo disciple carries a stored temperament (as a real recruit would), so the sample reports show the new persisted epithets rather than the name-hash fallback.
  const squad = PLAYER_SQUAD.map((name, i): BattleParticipant => ({ id: `p${i}`, name, temperament: DISCIPLE_TEMPERAMENTS[i % DISCIPLE_TEMPERAMENTS.length] }))
  return s.side === 'attack'
    ? {
        seed,
        attackerPower: s.playerPower,
        defenderPower: s.enemyPower,
        attackerParticipants: squad,
        attackerLeaderId: squad[0].id,
        attackerLeaderTrait: s.playerTrait,
        terrain: s.terrain,
        defenderName: s.enemyName,
      }
    : {
        seed,
        attackerPower: s.enemyPower,
        defenderPower: s.playerPower,
        attackerName: s.enemyName,
        defenderParticipants: squad,
        defenderLeaderId: squad[0].id,
        defenderLeaderTrait: s.playerTrait,
        terrain: s.terrain,
        defenderName: 'your sect',
      }
}

function runSampleReports(): void {
  const scenarios: Scenario[] = [
    { title: 'Raid — the player storms an NPC holding', side: 'attack', playerPower: 1650, enemyPower: 1000, playerTrait: 'ruthless', terrain: 'fortress', enemyName: 'Wardens of the Ashen Vale (5 defenders)', want: (o) => o.won && !o.drawn },
    { title: 'Seat defense — an NPC raid is thrown back', side: 'defense', playerPower: 1000, enemyPower: 860, playerTrait: 'inspiring', terrain: 'mountain', enemyName: 'the Crimson Lotus Sect', want: (o) => !o.won && !o.drawn },
    { title: 'Stalemate — both sides break off (Phase 9 draw)', side: 'attack', playerPower: 1000, enemyPower: 1000, playerTrait: 'cautious', terrain: 'river', enemyName: 'Iron Fang Company (5 defenders)', want: (o) => o.drawn },
    { title: 'Pyrrhic reversal — the player had the odds but withdrew', side: 'attack', playerPower: 1150, enemyPower: 1000, playerTrait: 'cautious', terrain: 'sacred', enemyName: 'Sable Court Guard (4 defenders)', want: (o) => !o.drawn && o.oddsWon && !o.won },
  ]

  scenarios.forEach((s, si) => {
    let found: { seed: number; narrative: BattleNarrative } | undefined
    for (let i = 0; i < 400_000 && !found; i++) {
      const seed = hashString(`report:${si}:${i}`) >>> 0
      const narrative = resolveBattle(scenarioParams(s, seed))
      if (s.want(narrative.outcome)) found = { seed, narrative }
    }
    console.log(`\n${'━'.repeat(72)}`)
    if (!found) {
      console.log(`${s.title}\n  (no seed produced this outcome in 400k tries — unexpected)`)
      return
    }
    const o = found.narrative.outcome
    const playerWon = s.side === 'attack' ? o.won : !o.won && !o.drawn
    const playerRatio = s.side === 'attack' ? s.playerPower / s.enemyPower : s.playerPower / s.enemyPower
    const tier = o.drawn ? 'draw' : getOutcomeTier(playerWon, playerRatio, o.intensity)
    const band = getAdvantageBand(o.attackerPower, o.defenderPower)
    console.log(`${s.title}   [seed ${found.seed}]`)
    console.log(
      `  ${TIER_LABEL[tier]} · Power ${o.attackerPower} vs ${o.defenderPower} · ${band.label}` +
        `${s.terrain && s.terrain !== 'open' ? ` · ${TERRAIN_EFFECTS[s.terrain].label}` : ''} · ${found.narrative.rounds} rounds`,
    )
    console.log('')
    // Print with a phase header when it changes, and mark the turning point / wounds, so the arc structure (§9) is visible in the harness.
    let lastPhase = ''
    for (const e of found.narrative.events) {
      if (e.phase !== lastPhase && e.phase !== 'opening') {
        console.log(`    — ${e.phase} —`)
        lastPhase = e.phase
      }
      const mark = e.kind === 'crit' ? '  ⚡ ' : e.kind === 'wound' ? '    · ' : '    '
      console.log(`${mark}${e.text}`)
    }
  })
  console.log(`\n${'━'.repeat(72)}`)
}

export function runSmellTest(): void {
  const balance = runBalanceSweep()
  runTraitSweep()
  const deterministic = checkDeterminism()

  console.log('\n=== Verdicts ===')
  // Both resolvers share winProbability by construction, so their base-odds win rates should match to within sampling noise (~±1% at 20k trials). The crit-moment swing (Phase 3) is symmetric, so it adds variance but no bias.
  console.log(`${balance.maxAgreementDelta < 0.02 ? 'PASS' : 'FAIL'}  dual-resolver base-odds agreement — max Δ ${(100 * balance.maxAgreementDelta).toFixed(2)}% (< 2%)`)
  console.log(`${balance.monotonic ? 'PASS' : 'FAIL'}  win rate is monotonic in power ratio`)
  console.log(
    `${balance.drawAtEven > balance.drawAtExtreme && balance.drawAtExtreme < 0.01 ? 'PASS' : 'FAIL'}  draws concentrate in close fights — even ${pct(balance.drawAtEven * TRIALS).trim()} vs extreme ${pct(balance.drawAtExtreme * TRIALS).trim()} (blowouts ≈ 0)`,
  )
  console.log(`${deterministic ? 'PASS' : 'FAIL'}  same seed reproduces an identical fight (report regeneration)`)
}

// Run only when executed directly (npm run smell-test), not when imported for reuse. `-- reports` prints sample narratives instead of the statistical sweep.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('reports')) runSampleReports()
  else runSmellTest()
}
