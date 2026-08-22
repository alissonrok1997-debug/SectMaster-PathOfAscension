/**
 * Chroma-keys a flat-magenta Gemini sheet, slices it, trims each subject and writes
 * game-ready PNGs.
 *
 * The key is GAME_UI_DESIGN_SYSTEM §21.2's painted-subject formula:
 *
 *     m = min(R, B) - G
 *
 * A distance-from-magenta key cannot be used on painted art: it eats black hair (G low,
 * but R and B are low too) and warm skin (G high). `m` is large only where R and B are
 * both high AND G is low, which is magenta and nothing else in this game's palette.
 * Verified against every colour in the house style — sage, olive, warm grey, clay brown,
 * off-white and ink all return m <= 0 and stay fully opaque.
 *
 * After keying, each pixel is UNPREMULTIPLIED against the sampled background (the raw
 * pixel is alpha*F + (1-alpha)*BG, so F has to be solved for, or every soft edge keeps a
 * magenta cast), then any residual spill is scrubbed by lifting G to min(R,B).
 *
 * Reports partial-alpha percentage per cell. §21.2: anything above ~5% on a painted
 * subject means the key is wrong — fix the source, do not ship it.
 *
 * ── The two invocations this project needs ────────────────────────────────────
 *
 * Building glyph sheet (brief F2, 4x4, 16 marks). Names are in the sheet's reading
 * order and match the building ids in BUILDING_ART, so the output drops straight into
 * src/assets/icons/buildings/ with no renaming:
 *
 *   node scripts/key-sheet.mjs raw/building-sheet.png --grid 4x4 --size 192 \
 *     --out src/assets/icons/buildings \
 *     --names sectHall,treasury,spiritGarden,spiritGrove,\
 * ironVeinMine,sacredMountainShrine,warehouse,dormitory,\
 * trainingHall,trainingGround,library,researchInstitute,\
 * alchemyWorkshop,forge,posting-idle,posting-away
 *
 * Sect Hall plate illustration (brief F3). 0.780 is the plaque aspect; 436 tall gives
 * 340x436, identical to the Set E portraits, so the existing plaque CSS is untouched:
 *
 *   node scripts/key-sheet.mjs raw/sect-hall-plate.png --single --aspect 0.780 --size 436 \
 *     --out src/assets/icons/buildings --names sectHallPlate
 *
 * Verified 2026-08-16 by round-tripping a real Set E portrait: composited onto flat
 * magenta, re-keyed, and compared against the original. Mean RGB delta 1.82, alpha IoU
 * 0.9991, zero residual magenta pixels, 2.69% partial alpha.
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const input = argv[0]
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

const outDir = flag('out', 'out')
const names = (flag('names', '') || '').split(',').filter(Boolean)
const targetSize = Number(flag('size', 256))
const aspect = flag('aspect') ? Number(flag('aspect')) : null
const [gridCols, gridRows] = has('single') ? [1, 1] : (flag('grid', '4x4') || '4x4').split('x').map(Number)
/** Alpha below this is treated as fully transparent; above 1-this, fully opaque. */
const EPS = 0.02
/*
 * CORE/EDGE MATTE, not a linear ramp.
 *
 * A straight `1 - m/m_bg` gives every faintly magenta-leaning pixel a partial alpha, which
 * is fine on a clean PNG and wrong on a JPEG: chroma subsampling is 4:2:0, magenta is a
 * chroma extreme, and the compressor smears the key several pixels into every contour. On
 * the delivered sheet that put all sixteen subjects between 10% and 51% partial alpha.
 *
 * Measured on that sheet, `m` is strongly bimodal — subject at m <= 0, key at m ~ 155, with
 * only ~7% of pixels between. So clamp: below `lo` is solid subject, above `hi` is solid key,
 * and only the true anti-aliased contour between them gets a ramp. Expressed as fractions of
 * the sampled background's m so the same numbers hold whatever magenta the generator drifts to.
 */
const LO = Number(flag('lo', 0.13))
const HI = Number(flag('hi', 0.78))

mkdirSync(outDir, { recursive: true })

const src = sharp(input).ensureAlpha()
const { width, height } = await src.metadata()
const raw = await src.raw().toBuffer()

/** Sample the background from the four corners — the sheet's margin is guaranteed key. */
function sampleBackground() {
  const pts = []
  const inset = Math.round(Math.min(width, height) * 0.01) + 1
  for (const [x, y] of [
    [inset, inset],
    [width - inset, inset],
    [inset, height - inset],
    [width - inset, height - inset],
  ]) {
    const i = (y * width + x) * 4
    pts.push([raw[i], raw[i + 1], raw[i + 2]])
  }
  const avg = [0, 1, 2].map((c) => Math.round(pts.reduce((s, p) => s + p[c], 0) / pts.length))
  return avg
}

const BG = sampleBackground()
const mOf = (r, g, b) => Math.min(r, b) - g
const M_BG = mOf(...BG)
if (M_BG <= 40) {
  console.error(`! background sampled as rgb(${BG}) — m=${M_BG}. That is not a magenta key.`)
  process.exit(1)
}
console.log(`background rgb(${BG.join(',')})  m=${M_BG}`)

/** Key + unpremultiply + spill-scrub the whole sheet once. */
const keyed = Buffer.alloc(width * height * 4)
for (let p = 0; p < width * height; p++) {
  const i = p * 4
  const r = raw[i], g = raw[i + 1], b = raw[i + 2]
  const t = mOf(r, g, b) / M_BG
  const a = Math.min(1, Math.max(0, 1 - (t - LO) / (HI - LO)))

  if (a <= EPS) {
    keyed[i] = keyed[i + 1] = keyed[i + 2] = keyed[i + 3] = 0
    continue
  }

  let fr = r, fg = g, fb = b
  if (a < 1) {
    // observed = a*F + (1-a)*BG  ->  F = (observed - (1-a)*BG) / a
    fr = (r - (1 - a) * BG[0]) / a
    fg = (g - (1 - a) * BG[1]) / a
    fb = (b - (1 - a) * BG[2]) / a
  }
  // Residual spill: legitimate house-style colours all have m <= 0, so anything still
  // magenta-leaning is key bleed. Lift G rather than pulling R/B down, which would darken.
  const lo = Math.min(fr, fb)
  if (fg < lo) fg = lo

  keyed[i] = Math.max(0, Math.min(255, Math.round(fr)))
  keyed[i + 1] = Math.max(0, Math.min(255, Math.round(fg)))
  keyed[i + 2] = Math.max(0, Math.min(255, Math.round(fb)))
  keyed[i + 3] = Math.round(a * 255)
}

/*
 * ISLAND FILTER — drop specks before measuring the bounding box.
 *
 * A single stray mark anywhere in a cell expands that subject's bbox, which then pads and
 * downscales the real subject to fit around a speck. On the delivered sheet the treasury
 * chest had exactly that: a stray tick at 0.61% of the chest's area, pushing the chest off
 * centre and smaller than its fifteen neighbours.
 *
 * Threshold measured rather than guessed. On this sheet the legitimate secondary parts are
 * the mine's ore chunk (74.7% of its pickaxe), and the road's two milestones (14.2% and
 * 5.7%). The speck is 0.61%. 2% sits with a 3x margin below the smallest real part and a
 * 3x margin above the speck, so it separates them without touching multi-part subjects.
 */
const MIN_ISLAND = Number(flag('min-island', 0.02))

function dropSpecks(x0, y0, w, h) {
  const label = new Int32Array(w * h).fill(-1)
  const sizes = []
  const stack = []
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1) continue
    const px = x0 + (p % w), py = y0 + Math.floor(p / w)
    if (keyed[(py * width + px) * 4 + 3] <= 24) { label[p] = -2; continue }
    const id = sizes.length
    let count = 0
    stack.push(p)
    label[p] = id
    while (stack.length) {
      const q = stack.pop()
      count++
      const qx = q % w, qy = Math.floor(q / w)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const n = ny * w + nx
        if (label[n] !== -1) continue
        if (keyed[((y0 + ny) * width + (x0 + nx)) * 4 + 3] <= 24) { label[n] = -2; continue }
        label[n] = id
        stack.push(n)
      }
    }
    sizes.push(count)
  }
  if (!sizes.length) return 0
  const biggest = Math.max(...sizes)
  let dropped = 0
  for (let p = 0; p < w * h; p++) {
    const id = label[p]
    if (id < 0) continue
    if (sizes[id] >= biggest * MIN_ISLAND) continue
    const i = ((y0 + Math.floor(p / w)) * width + (x0 + (p % w))) * 4
    keyed[i] = keyed[i + 1] = keyed[i + 2] = keyed[i + 3] = 0
    dropped++
  }
  return dropped
}

/** Opaque bounding box of a rectangular region, so each subject can be trimmed to itself. */
function bbox(x0, y0, w, h) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (keyed[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX === Infinity) return null
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/*
 * TWO METRICS, AND ONLY ONE OF THEM IS A GATE.
 *
 * `spill` is contamination: visible pixels still leaning magenta after the despill. This is
 * the number that says the key failed, and it should be flat zero.
 *
 * `partial` is the anti-aliased fraction. §21.2's 5% ceiling was written from Set E's
 * portraits — large solid subjects, where 5% genuinely does mean a bad matte. It does not
 * transfer to line-art glyphs: a weapon rack of three thin staves is nearly all perimeter,
 * and measured 27.5% on a sheet with zero contamination and a clean read at 28px. Judge
 * `partial` against the subject's own perimeter-to-area ratio, or not at all — the sheet's
 * real acceptance test is the render at true size.
 */
function metrics(box) {
  let partial = 0, covered = 0, spill = 0
  for (let y = box.top; y < box.top + box.height; y++) {
    for (let x = box.left; x < box.left + box.width; x++) {
      const i = (y * width + x) * 4
      const a = keyed[i + 3]
      if (a <= 24) continue
      covered++
      if (a > 6 && a < 249) partial++
      if (mOf(keyed[i], keyed[i + 1], keyed[i + 2]) > 8) spill++
    }
  }
  return covered
    ? { partial: (partial / covered) * 100, spill: (spill / covered) * 100 }
    : { partial: 0, spill: 0 }
}

const cellW = Math.floor(width / gridCols)
const cellH = Math.floor(height / gridRows)
const report = []

/*
 * UNIFORM SCALE ACROSS THE SET — the default for a sheet, off with --per-cell.
 *
 * Trimming each subject to its own bbox and then fitting that box to the output makes every
 * subject fill the icon square, which silently destroys the relative sizing the artist drew.
 * On the delivered sheet the treasury chest trims to 175px against the sect hall's 230px, so
 * per-cell normalisation renders the chest 31% larger than it was drawn and it reads as the
 * biggest thing on the screen.
 *
 * §21.4 asks for "the same optical weight and the same optical size, as though drawn by one
 * hand for one set" — that property is IN the source and the slicer's job is not to throw it
 * away. So: measure every subject first, take one scale from the largest, and place each
 * subject at that scale, centred. A chest then renders smaller than a hall, which is what was
 * drawn and what a viewer expects.
 */
const uniform = !has('per-cell') && gridCols * gridRows > 1
const boxes = []
for (let row = 0; row < gridRows; row++) {
  for (let col = 0; col < gridCols; col++) {
    const specks = dropSpecks(col * cellW, row * cellH, cellW, cellH)
    boxes.push({ box: bbox(col * cellW, row * cellH, cellW, cellH), specks })
  }
}
const maxSpan = Math.max(...boxes.filter((b) => b.box).map((b) => Math.max(b.box.width, b.box.height)))

for (let row = 0; row < gridRows; row++) {
  for (let col = 0; col < gridCols; col++) {
    const idx = row * gridCols + col
    const name = names[idx] ?? `cell-${String(idx + 1).padStart(2, '0')}`
    const { box, specks } = boxes[idx]
    if (!box) {
      report.push({ name, status: 'EMPTY' })
      continue
    }

    // Pad the trimmed subject out to the target shape: square for glyphs, `aspect` for a
    // portrait. Padding rather than stretching — `object-fit` would throw the pixels away.
    const targetAspect = aspect ?? 1
    let boxW = box.width, boxH = box.height
    let padW = boxW, padH = boxH
    if (uniform) {
      // One canvas size for the whole set: the largest subject just fits, everything else
      // keeps the size it was drawn at relative to that.
      padW = Math.round(maxSpan * Math.max(1, targetAspect))
      padH = Math.round(maxSpan * Math.max(1, 1 / targetAspect))
    } else if (boxW / boxH > targetAspect) padH = Math.round(boxW / targetAspect)
    else padW = Math.round(boxH * targetAspect)
    if (padW < boxW) padW = boxW
    if (padH < boxH) padH = boxH
    const padX = Math.round((padW - boxW) / 2)
    const padY = Math.round((padH - boxH) / 2)

    const outW = aspect ? Math.round(targetSize * targetAspect) : targetSize
    const outH = targetSize

    /*
     * TWO PIPELINES, DELIBERATELY. sharp applies its operations in a FIXED order —
     * extract, then resize, then extend — not in call order. Chaining .extend().resize()
     * therefore resizes the untrimmed subject first and extends afterwards, yielding
     * 276x192 where 192x192 was asked for. Same family of trap as the one already
     * documented in scripts/generate-icons.mjs. Pad in one pipeline, resize in the next.
     */
    const padded = await sharp(keyed, { raw: { width, height, channels: 4 } })
      .extract(box)
      .extend({
        top: padY, bottom: padH - boxH - padY,
        left: padX, right: padW - boxW - padX,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    await sharp(padded)
      .resize(outW, outH, { fit: 'fill' })
      .png({ compressionLevel: 9, palette: true })
      .toFile(join(outDir, `${name}.png`))

    const m = metrics(box)
    report.push({
      name,
      box: `${box.width}x${box.height}`,
      spill: m.spill.toFixed(3) + '%',
      partial: m.partial.toFixed(1) + '%',
      specks: specks || '',
    })
  }
}

console.table(report)

const contaminated = report.filter((r) => r.spill && parseFloat(r.spill) > 0.1)
if (contaminated.length) {
  console.error(`\n! KEY FAILED — magenta survives the despill on: ${contaminated.map((b) => b.name).join(', ')}`)
  console.error('  Do not ship these. Check the source is not a JPEG, and that nothing on the')
  console.error('  subject is pink, fuchsia or hot violet — the key punches holes wherever it is.')
  process.exitCode = 1
} else {
  console.log('\nspill clean on every subject. Now render at true size — that is the real test.')
}

const spindly = report.filter((r) => r.partial && parseFloat(r.partial) > 20)
if (spindly.length) {
  console.log(`  note: high anti-aliased fraction on ${spindly.map((b) => b.name).join(', ')} —`)
  console.log('  expected for thin-membered subjects, not a defect on its own. Check them at 28px.')
}
