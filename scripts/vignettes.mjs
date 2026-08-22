/**
 * Slices the three Missions plate vignettes out of the delivered sheet and writes them at the
 * 118x151 plaque aspect (0.780), 340x436 for DPR 3 — the same output contract as the Set E
 * portraits and the Sect Hall plate, so the shipped plaque CSS is untouched.
 *
 * Two differences from `key-sheet.mjs`, both because this sheet is NOT chroma-keyed:
 *
 *  - The subjects sit on cream paper, not magenta, so the background is sampled from the
 *    panel's own corners and removed with the same unpremultiply the chroma key uses —
 *    `observed = a*F + (1-a)*BG` solved for F — with BG as paper instead of magenta.
 *  - The panels are not an even grid: the sheet came back as two square panels on the top row
 *    and one wide panel below, so the rectangles are measured rather than divided.
 *
 * Writes both variants for comparison; the render decides which ships.
 *   opaque/  the vignette kept opaque, its paper tinted from the delivered #f9f3e5 onto the
 *            parchment ramp, to sit inside the gold arch as a painting in a frame
 *   keyed/   paper removed, ink on transparency, to sit directly on the plate's own paper
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'raw/Gemini_Generated_Image_uyu9kkuyu9kkuyu9.jpg'
const ASPECT = 0.780
const OUT_H = 436
const OUT_W = Math.round(OUT_H * ASPECT) // 340
/** The outer 8% is under the arch and must carry nothing important (§21.5 safe area). */
const SAFE = 0.08
/** Escape JPEG ringing along each panel's edge against the white sheet. */
const INSET = 5

/** Measured off the delivered sheet, not divided — see the header. */
const PANELS = [
  { name: 'gathering', left: 17, top: 18, width: 486, height: 486 },
  { name: 'hunting', left: 520, top: 18, width: 486, height: 486 },
  { name: 'escort', left: 276, top: 520, width: 731, height: 487 },
]

/** The plaque's own paper. Not the --parch token: the shipped rule sets the plate img's
 * backdrop to #efe7d6, which is --parch after the paper tile multiplies over it. Matching the
 * token instead leaves the vignette reading as a pale patch inside the arch. */
const PARCH = [0xef, 0xe7, 0xd6]

mkdirSync('out/vignettes/opaque', { recursive: true })
mkdirSync('out/vignettes/keyed', { recursive: true })

const sheet = sharp(SRC)
const meta = await sheet.metadata()
const raw = await sheet.raw().toBuffer()
const SW = meta.width

const px = (x, y) => {
  const i = (y * SW + x) * 3
  return [raw[i], raw[i + 1], raw[i + 2]]
}

const report = []

for (const p of PANELS) {
  const x0 = p.left + INSET
  const y0 = p.top + INSET
  const w = p.width - INSET * 2
  const h = p.height - INSET * 2

  // Paper sampled from the panel's own four corners — the vignette's margin is empty by brief.
  const corners = [
    px(x0 + 2, y0 + 2),
    px(x0 + w - 3, y0 + 2),
    px(x0 + 2, y0 + h - 3),
    px(x0 + w - 3, y0 + h - 3),
  ]
  const BG = [0, 1, 2].map((c) => Math.round(corners.reduce((s, q) => s + q[c], 0) / corners.length))
  const bgLuma = 0.299 * BG[0] + 0.587 * BG[1] + 0.114 * BG[2]

  // Coverage: how far below the paper this pixel sits, as a fraction of the paper's own luma.
  // A pixel at paper luma is empty; ink at ~20% luma is solid. The 0.14 floor is what keeps
  // JPEG mottle in the empty margin from becoming a haze of 2%-alpha pixels.
  const FLOOR = 0.14
  const cov = new Float32Array(w * h)
  const ink = Buffer.alloc(w * h * 4)
  const tinted = Buffer.alloc(w * h * 3)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x0 + x, y0 + y)
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      let a = 1 - luma / bgLuma
      a = a <= FLOOR / 4 ? 0 : Math.min(1, Math.max(0, (a - FLOOR / 4) / (0.62 - FLOOR / 4)))
      cov[y * w + x] = a

      const i = (y * w + x) * 4
      if (a <= 0.008) {
        ink[i] = ink[i + 1] = ink[i + 2] = ink[i + 3] = 0
      } else {
        // F = (observed - (1-a)*BG) / a
        ink[i] = Math.max(0, Math.min(255, Math.round((r - (1 - a) * BG[0]) / a)))
        ink[i + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - a) * BG[1]) / a)))
        ink[i + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - a) * BG[2]) / a)))
        ink[i + 3] = Math.round(a * 255)
      }

      // Opaque variant: same image with its paper mapped onto the parchment ramp. A multiply
      // rather than a hue shift — white maps to the parch tone and the ink keeps its value.
      const t = (y * w + x) * 3
      tinted[t] = Math.round((r / 255) * PARCH[0])
      tinted[t + 1] = Math.round((g / 255) * PARCH[1])
      tinted[t + 2] = Math.round((b / 255) * PARCH[2])
    }
  }

  /*
   * FOCAL bounding box, at a HIGH coverage threshold — not the full ink extent.
   *
   * Composing on all ink was the first attempt and it produced a subject filling 45% of the
   * plaque height, illegible at 118x151. The cause is that every panel carries pale mist and
   * wash out to its own margins, so the ink bbox is the whole panel and "fit the ink" means
   * "fit the scene". At 0.40 the mist drops out and what is left is the drawn subject: the
   * wolf, the basket and terrace edges, the cart and its marker.
   *
   * The window is then sized off the SUBJECT and is allowed to be narrower than the scene —
   * cropping a wide landscape down to a portrait, which is the whole job here. The panels
   * came back as square landscape scenes because the brief asked for a square canvas; that
   * is a brief error, corrected in processing rather than by regenerating.
   */
  /*
   * A coverage THRESHOLD was tried first and does not work: the pen line runs through the
   * mist and the terrace edges as well as through the subject, so at any threshold the
   * bounding box is still the whole panel (449x328 of 476). Ink extent is the wrong measure.
   *
   * Ink MASS is the right one. The marginal distributions of coverage over x and over y are
   * strongly peaked on the drawn subject and thin across the wash, so the 12th-to-88th
   * percentile of mass is the region the drawing is actually about, and it is stable under
   * regeneration in a way a hand-typed rectangle would not be.
   */
  const P = 0.12
  const marginal = (n, get) => {
    const acc = new Float64Array(n)
    for (let i = 0; i < n; i++) acc[i] = get(i)
    const total = acc.reduce((s, v) => s + v, 0)
    let run = 0, lo = 0, hi = n - 1
    for (let i = 0; i < n; i++) {
      run += acc[i]
      if (run >= total * P) { lo = i; break }
    }
    run = 0
    for (let i = n - 1; i >= 0; i--) {
      run += acc[i]
      if (run >= total * P) { hi = i; break }
    }
    return [lo, hi]
  }
  const [x1, x2] = marginal(w, (x) => {
    let s = 0
    for (let y = 0; y < h; y++) s += cov[y * w + x]
    return s
  })
  const [y1, y2] = marginal(h, (y) => {
    let s = 0
    for (let x = 0; x < w; x++) s += cov[y * w + x]
    return s
  })
  const minX = x1, maxX = x2, minY = y1, maxY = y2
  const inkW = maxX - minX + 1
  const inkH = maxY - minY + 1
  /* The coverage-weighted MEAN, not the midpoint of the range. On `escort` the drawn subject
     — cart and marker stone — sits to the right of a wide field of sparse background rock, so
     the midpoint lands in the rock and the crop cuts the cart. The mean is pulled toward
     wherever the ink actually is. */
  let mx = 0, mw = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = cov[y * w + x]
      mx += x * a
      mw += a
    }
  }
  const cx = Math.round(mx / mw)

  /* The subject fills 58% of the plaque height, which is what reads at 118x151 while still
     leaving the open paper above that the composition asks for. */
  const FILL = 0.58
  let winH = Math.round(inkH / FILL)
  let winW = Math.round(winH * ASPECT)
  // Prefer to show the whole subject: if it is wider than the window, the window grows to it.
  if (winW < inkW / (1 - SAFE * 2)) {
    winW = Math.round(inkW / (1 - SAFE * 2))
    winH = Math.round(winW / ASPECT)
  }
  /*
   * But the window may never exceed the panel. `escort` is the case that forces this: its ink
   * is 500x190 — a wide, shallow scene — so growing the window to hold all of it asks for 763
   * rows out of a 477-row panel, and the overhang pads as flat cream at both ends. Capping to
   * the panel and cropping the scene's flanks is the correct trade: this is a portrait plaque,
   * and a landscape scene has to lose its edges to become one.
   */
  if (winH > h) { winH = h; winW = Math.round(winH * ASPECT) }
  if (winW > w) { winW = w; winH = Math.round(winW / ASPECT) }
  /*
   * PAD AT THE TOP ONLY, CLAMP EVERYWHERE ELSE.
   *
   * The first version padded any overhang with flat paper, which is right above the drawing —
   * that edge is empty paper by composition — and wrong below it, where the drawing runs to
   * the ground. On `gathering` the window overshot the panel foot by ~10% and the flat fill
   * rendered as a pale band across the bottom of the arch, brighter than the wash it abutted.
   * So the bottom and the sides clamp into the panel, and only the top is allowed to extend.
   */
  let winX = Math.round(cx - winW / 2)
  // Subject centre lands at 60% of the window height: low in the frame, paper above.
  let winY = Math.round(minY + inkH / 2 - winH * 0.60)
  if (winW <= w) winX = Math.min(Math.max(0, winX), w - winW)
  if (winH <= h) winY = Math.min(winY, h - winH)

  report.push({
    name: p.name,
    panel: `${p.width}x${p.height}`,
    ink: `${inkW}x${inkH}`,
    window: `${winW}x${winH}`,
    'pad top': Math.max(0, -winY) || '',
  })

  // The window can fall outside the panel — extend with the panel's own paper (opaque) or
  // with transparency (keyed) rather than clamping, which would slide the subject off-centre.
  const extend = {
    top: Math.max(0, -winY),
    left: Math.max(0, -winX),
    bottom: Math.max(0, winY + winH - h),
    right: Math.max(0, winX + winW - w),
  }
  const crop = {
    left: Math.max(0, winX),
    top: Math.max(0, winY),
    width: Math.min(w, winX + winW) - Math.max(0, winX),
    height: Math.min(h, winY + winH) - Math.max(0, winY),
  }

  await sharp(ink, { raw: { width: w, height: h, channels: 4 } })
    .extract(crop)
    .extend({ ...extend, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
    .then((b) =>
      sharp(b).resize(OUT_W, OUT_H, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(join('out/vignettes/keyed', `${p.name}.png`)),
    )

  await sharp(tinted, { raw: { width: w, height: h, channels: 3 } })
    .extract(crop)
    .extend({ ...extend, background: { r: PARCH[0], g: PARCH[1], b: PARCH[2], alpha: 1 } })
    .png()
    .toBuffer()
    .then((b) =>
      sharp(b).resize(OUT_W, OUT_H, { fit: 'fill' }).png({ compressionLevel: 9 }).toFile(join('out/vignettes/opaque', `${p.name}.png`)),
    )
}

console.table(report)
