// Generate raster favicon fallbacks from the composed logo SVG (public/favicon.svg).
// SVG favicons aren't universally supported (older browsers, search engines), so we ship
// PNG sizes + a favicon.ico (a 32px PNG wrapped in an ICO container).
//   node scripts/gen-favicon.mjs
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url))
const SRC = join(PUBLIC, 'favicon.svg')

// Render the SVG large once, then downsample to each target for crisp small icons.
const base = await sharp(SRC, { density: 384 }).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()

async function png(size, name) {
  const buf = await sharp(base).resize(size, size).png().toBuffer()
  await writeFile(join(PUBLIC, name), buf)
  console.log('wrote', name)
  return buf
}

const p16 = await png(16, 'favicon-16x16.png')
const p32 = await png(32, 'favicon-32x32.png')
// Google Search prefers a square favicon that's a multiple of 48px (>=48).
await png(48, 'favicon-48x48.png')
await png(96, 'favicon-96x96.png')

// Build a minimal ICO containing the 16px and 32px PNG entries.
function icoEntry(pngBuf, size, offset) {
  const e = Buffer.alloc(16)
  e.writeUInt8(size >= 256 ? 0 : size, 0) // width
  e.writeUInt8(size >= 256 ? 0 : size, 1) // height
  e.writeUInt8(0, 2) // palette
  e.writeUInt8(0, 3) // reserved
  e.writeUInt16LE(1, 4) // color planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(pngBuf.length, 8) // size of image data
  e.writeUInt32LE(offset, 12) // offset of image data
  return e
}
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(2, 4) // count
const firstOffset = 6 + 16 * 2
const e16 = icoEntry(p16, 16, firstOffset)
const e32 = icoEntry(p32, 32, firstOffset + p16.length)
await writeFile(join(PUBLIC, 'favicon.ico'), Buffer.concat([header, e16, e32, p16, p32]))
console.log('wrote favicon.ico')
console.log('done')
