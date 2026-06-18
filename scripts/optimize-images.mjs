// Generates WebP siblings for the PNG brand assets, resized to real display dimensions.
//
// Why: the source sport icons are 512x512 PNGs (80-215 KB each) but render as small as 46px
// (hero pips max out at 150px). Shipping 512px PNGs is ~10x oversampled — wasted bytes plus
// slow image decode that janks scrolling, especially in Firefox. WebP at the real ceiling size
// cuts each asset ~80-90%. PNGs are kept in place as the original source; the app references the
// .webp (WebP is supported by every browser we target — Firefox 65+, Safari 14+, all Chromium).
//
// Run: node scripts/optimize-images.mjs   (or `npm run images`)
import { readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = fileURLToPath(new URL('../public/assets/', import.meta.url))

// Only the folders the app actually references. Icons get capped to 320px (covers hero@2x = 300px);
// banners keep more detail (they render as full-bleed background-cover art).
const TARGETS = [
  { dir: 'sport-icons/neon-3d', maxSize: 320, quality: 82 },
  { dir: 'sport-icons/brushed-plates', maxSize: 320, quality: 82 },
  { dir: 'sport-icons/brushed-mask', maxSize: 320, quality: 82 },
  { dir: 'sport-banners/ink', maxSize: 1024, quality: 80 },
]

let totalPngBytes = 0
let totalWebpBytes = 0
let count = 0

for (const target of TARGETS) {
  const absDir = join(ROOT, target.dir)
  let entries
  try {
    entries = await readdir(absDir)
  } catch {
    console.warn(`skip (missing): ${target.dir}`)
    continue
  }

  for (const name of entries) {
    if (extname(name).toLowerCase() !== '.png') continue
    const src = join(absDir, name)
    const out = src.replace(/\.png$/i, '.webp')

    const pngBytes = (await stat(src)).size
    await sharp(src)
      // `withoutEnlargement` never upscales smaller-than-target assets.
      .resize({ width: target.maxSize, height: target.maxSize, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: target.quality })
      .toFile(out)
    const webpBytes = (await stat(out)).size

    totalPngBytes += pngBytes
    totalWebpBytes += webpBytes
    count++
    const saved = (100 * (1 - webpBytes / pngBytes)).toFixed(0)
    console.log(`${target.dir}/${name}: ${(pngBytes / 1024).toFixed(0)}KB -> ${(webpBytes / 1024).toFixed(0)}KB (-${saved}%)`)
  }
}

console.log(
  `\nDone: ${count} files. ${(totalPngBytes / 1024 / 1024).toFixed(2)}MB PNG -> ${(totalWebpBytes / 1024 / 1024).toFixed(2)}MB WebP ` +
    `(${(100 * (1 - totalWebpBytes / totalPngBytes)).toFixed(0)}% smaller).`,
)
