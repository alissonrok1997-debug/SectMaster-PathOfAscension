/**
 * Generates every launcher icon size from one square source.
 *
 *   1. Save the Gemini output as public/icons/source-1024.png (opaque, 1024×1024)
 *   2. npm run icons
 *
 * Two families are produced:
 *   icon-*.png          — the art edge to edge, for browsers that don't mask
 *   icon-maskable-*.png — the same art scaled into the centre 80% on an opaque
 *                         background, so Android can crop to a circle or squircle
 *                         without eating the subject
 */
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconDir = join(root, 'public', 'icons')
const source = join(iconDir, 'source-1024.png')

const BACKGROUND = { r: 0x12, g: 0x13, b: 0x1a, alpha: 1 } // #12131a, the app background
const SIZES = [192, 512]
/** Android's maskable safe zone is the centre 80%; anything outside can be cropped. */
const SAFE_ZONE = 0.8

if (!existsSync(source)) {
  console.error(
    `\nMissing ${source}\n\n` +
      `Generate the icon first — the prompt is in public/icons/APP_ICON_PROMPT.md —\n` +
      `then save it as source-1024.png in that folder and re-run.\n`,
  )
  process.exit(1)
}

mkdirSync(iconDir, { recursive: true })

const meta = await sharp(source).metadata()
if (meta.width !== meta.height) {
  console.warn(`! source is ${meta.width}×${meta.height}, not square — it will be centre-cropped`)
}
if (meta.width < 512) {
  console.warn(`! source is only ${meta.width}px wide; 1024 is recommended for a crisp 512 icon`)
}

for (const size of SIZES) {
  // Plain: fill the frame, flattened onto the app background in case the source has alpha.
  await sharp(source)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(join(iconDir, `icon-${size}.png`))

  // Maskable: shrink into the safe zone, pad the rest with the background colour.
  // `inner + 2 * pad` is already `size`, so there must be NO trailing .resize() here:
  // sharp honours only one resize per pipeline and the later call wins, which silently
  // skipped the shrink and emitted size/0.8 files (230 and 614) that disagreed with the
  // `sizes` the manifest declares.
  const inner = Math.round(size * SAFE_ZONE)
  const pad = Math.round((size - inner) / 2)
  await sharp(source)
    .resize(inner, inner, { fit: 'cover' })
    .flatten({ background: BACKGROUND })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(join(iconDir, `icon-maskable-${size}.png`))
}

// Apple devices ignore the manifest and read this link tag instead.
await sharp(source)
  .resize(180, 180, { fit: 'cover' })
  .flatten({ background: BACKGROUND })
  .png({ compressionLevel: 9 })
  .toFile(join(iconDir, 'apple-touch-icon.png'))

// Favicon for the browser tab.
await sharp(source)
  .resize(48, 48, { fit: 'cover' })
  .flatten({ background: BACKGROUND })
  .png({ compressionLevel: 9 })
  .toFile(join(iconDir, 'favicon.png'))

console.log('Wrote icon-192/512, icon-maskable-192/512, apple-touch-icon, favicon to public/icons/')
