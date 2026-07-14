import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import TextToSVG from 'text-to-svg'

const defaultRoot = process.cwd()
const brandGreen = '#4dff8a'
const warmPaper = '#f4ead8'
const voidBlack = '#0b0a08'
const paperInk = '#17130f'

const brandFontFiles = {
  display: 'Bungee-Regular.ttf',
  head: 'ArchivoBlack-Regular.ttf',
  sans: 'SpaceGrotesk-Bold.ttf',
  mono: 'IBMPlexMono-Bold.ttf',
}

function extractLogoPath(svg) {
  const match = svg.match(/<path\s+d="([^"]+)"/)
  if (!match) throw new Error('Could not find Silbo logo path data.')
  return match[1]
}

async function readLogoPath(rootDir) {
  const svg = await fs.readFile(path.join(rootDir, 'public/assets/brand/silbo-whistle-trace.svg'), 'utf8')
  return extractLogoPath(svg)
}

function loadBrandText(rootDir) {
  const fontDir = path.join(rootDir, 'public/assets/brand/fonts')
  return {
    display: TextToSVG.loadSync(path.join(fontDir, brandFontFiles.display)),
    head: TextToSVG.loadSync(path.join(fontDir, brandFontFiles.head)),
    sans: TextToSVG.loadSync(path.join(fontDir, brandFontFiles.sans)),
    mono: TextToSVG.loadSync(path.join(fontDir, brandFontFiles.mono)),
  }
}

function textPath(font, text, { x, y, size, fill, opacity = 1, anchor = 'top' }) {
  const d = font.getD(String(text), { x, y, fontSize: size, anchor })
  return `<path d="${d}" fill="${fill}"${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`
}

export function createFaviconSvg(logoPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <defs>
    <radialGradient id="halo" cx="50%" cy="54%" r="55%">
      <stop offset="0" stop-color="${brandGreen}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${brandGreen}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="0.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="72" height="72" rx="16" fill="${voidBlack}"/>
  <rect width="72" height="72" rx="16" fill="url(#halo)"/>
  <path transform="translate(5.2 10.8) scale(0.096)" d="${logoPath}" fill="${brandGreen}" fill-rule="evenodd" filter="url(#glow)"/>
</svg>
`
}

export function createEmailLockupSvgWithText(logoPath, text) {
  return `<svg width="430" height="96" viewBox="0 0 430 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="softGlow" x="-18%" y="-45%" width="136%" height="190%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path transform="translate(0 12) scale(0.14)" d="${logoPath}" fill="${brandGreen}" fill-rule="evenodd" opacity="0.42" filter="url(#softGlow)"/>
  <path transform="translate(0 12) scale(0.14)" d="${logoPath}" fill="${brandGreen}" fill-rule="evenodd"/>
  ${textPath(text.display, 'SILBO SPORTS', { x: 112, y: 28, size: 37, fill: brandGreen, opacity: 0.42 })}
  ${textPath(text.display, 'SILBO SPORTS', { x: 112, y: 28, size: 37, fill: brandGreen })}
</svg>
`
}

export function createOgCoverSvg(logoPath) {
  return createOgCoverSvgWithText(logoPath, loadBrandText(defaultRoot))
}

export function createOgCoverSvgWithText(logoPath, text) {
  const rows = [
    ['6:00 PM', 'EDT', 'Canada vs Qatar', 'Group B - Matchday 8 - Vancouver'],
    ['8:30 PM', 'EDT', 'Brazil vs Haiti', 'Group C - Matchday 9 - Philadelphia'],
    ['7:00 PM', 'Local', 'Formula 1 race weekend', 'Practice - qualifying - sprint - race'],
    ['10:00 PM', 'Local', 'UFC / PFL fight cards', 'Main cards - prelims - fighter alerts'],
  ]

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070806"/>
      <stop offset="0.48" stop-color="#10100c"/>
      <stop offset="1" stop-color="#051b10"/>
    </linearGradient>
    <radialGradient id="greenHalo" cx="15%" cy="18%" r="74%">
      <stop offset="0" stop-color="${brandGreen}" stop-opacity="0.24"/>
      <stop offset="0.45" stop-color="#35f5ff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#07110b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="logoGrad" x1="80" y1="54" x2="214" y2="178" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#38eaff"/>
      <stop offset="0.44" stop-color="${brandGreen}"/>
      <stop offset="0.75" stop-color="#ff4fd8"/>
      <stop offset="1" stop-color="#ffc24b"/>
    </linearGradient>
    <linearGradient id="paperRow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fffaf0"/>
      <stop offset="1" stop-color="#f1e6d2"/>
    </linearGradient>
    <linearGradient id="timeStub" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#082c1c"/>
      <stop offset="1" stop-color="#087549"/>
    </linearGradient>
    <filter id="softGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="4.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="rowShadow" x="-4%" y="-30%" width="108%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#greenHalo)"/>
  <g opacity="0.12" stroke="${brandGreen}" stroke-width="1">
    ${Array.from({ length: 16 }, (_, i) => `<path d="M0 ${32 + i * 38}H1200"/>`).join('')}
    ${Array.from({ length: 22 }, (_, i) => `<path d="M${44 + i * 54} 0V630"/>`).join('')}
  </g>
  <g opacity="0.18" stroke="${warmPaper}" stroke-width="1.2">
    <path d="M1008 62h126v126h-126z"/>
    <path d="M1041 62v126M1101 62v126M1008 125h126M1068 96a30 30 0 0 0 0 58"/>
  </g>

  <rect x="42" y="34" width="1116" height="164" rx="24" fill="#07100b" fill-opacity="0.82" stroke="${brandGreen}" stroke-opacity="0.58" stroke-width="2"/>
  <g transform="translate(82 68)">
    <path transform="scale(0.185)" d="${logoPath}" fill="url(#logoGrad)" fill-rule="evenodd" filter="url(#softGlow)"/>
    <path d="M151 16v104" stroke="${warmPaper}" stroke-opacity="0.38" stroke-width="2"/>
    ${textPath(text.display, 'SILBO SPORTS', { x: 188, y: 12, size: 56, fill: brandGreen })}
    ${textPath(text.head, 'Every game, match, race, and card in your calendar', { x: 190, y: 76, size: 28, fill: warmPaper })}
    ${textPath(text.mono, 'LOCAL TIME - LIVE SYNC - STATIC PACKS - REMINDERS', { x: 192, y: 116, size: 15, fill: brandGreen })}
  </g>

  <rect x="42" y="218" width="1116" height="58" rx="14" fill="#0b120d" fill-opacity="0.9" stroke="${brandGreen}" stroke-opacity="0.5"/>
  ${textPath(text.mono, 'CANADA', { x: 120, y: 237, size: 25, fill: warmPaper })}
  ${textPath(text.mono, '/', { x: 318, y: 237, size: 25, fill: brandGreen })}
  ${textPath(text.mono, 'BRAZIL', { x: 365, y: 237, size: 25, fill: warmPaper })}
  ${textPath(text.mono, '/', { x: 552, y: 237, size: 25, fill: brandGreen })}
  ${textPath(text.mono, 'FORMULA 1', { x: 600, y: 237, size: 25, fill: warmPaper })}
  ${textPath(text.mono, '/', { x: 844, y: 237, size: 25, fill: brandGreen })}
  ${textPath(text.mono, 'FIGHT CARDS', { x: 890, y: 237, size: 25, fill: warmPaper })}

  <g transform="translate(58 306)">
    ${rows
      .map(
        ([time, zone, title, detail], index) => `<g transform="translate(0 ${index * 57})" filter="url(#rowShadow)">
      <rect x="0" y="0" width="1084" height="48" rx="12" fill="url(#paperRow)"/>
      <rect x="0" y="0" width="176" height="48" rx="12" fill="url(#timeStub)" stroke="${brandGreen}" stroke-width="1.2"/>
      <path d="M176 0v48" stroke="${brandGreen}" stroke-width="2"/>
      ${textPath(text.mono, time, { x: 34, y: 9, size: 21, fill: brandGreen })}
      ${textPath(text.mono, zone, { x: 68, y: 29, size: 12, fill: warmPaper })}
      ${textPath(text.head, title, { x: 212, y: 15, size: 25, fill: paperInk })}
      ${textPath(text.sans, detail, { x: 612, y: 17, size: 16, fill: '#62584a' })}
      ${textPath(text.mono, String(index + 1).padStart(2, '0'), { x: 1025, y: 14, size: 21, fill: '#9b9a79' })}
    </g>`,
      )
      .join('')}
  </g>

  <g transform="translate(64 590)">
    <rect x="0" y="-24" width="12" height="42" fill="${brandGreen}"/>
    ${textPath(text.sans, 'Share a live watch board or save a clean static schedule.', { x: 36, y: -18, size: 21, fill: warmPaper })}
    ${textPath(text.mono, 'SILBOSPORTS.COM', { x: 920, y: -15, size: 16, fill: brandGreen })}
  </g>
</svg>
`
}

// Wrap a PNG in a single-image ICO container (PNG-in-ICO is supported by all modern browsers and by
// Google's favicon fetcher). Avoids pulling in an ICO-encoder dependency.
function pngToIco(png, size) {
  const dim = size >= 256 ? 0 : size
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: 1 = icon
  header.writeUInt16LE(1, 4) // image count
  const entry = Buffer.alloc(16)
  entry.writeUInt8(dim, 0) // width
  entry.writeUInt8(dim, 1) // height
  entry.writeUInt8(0, 2) // palette colors
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(png.length, 8) // image data size
  entry.writeUInt32LE(6 + 16, 12) // offset to image data
  return Buffer.concat([header, entry, png])
}

export async function writeBrandAssets(targetDir, { rootDir = defaultRoot } = {}) {
  await fs.mkdir(targetDir, { recursive: true })
  const logoPath = await readLogoPath(rootDir)
  const text = loadBrandText(rootDir)
  const faviconSvg = createFaviconSvg(logoPath)
  const emailLockupSvg = createEmailLockupSvgWithText(logoPath, text)
  const ogSvg = createOgCoverSvgWithText(logoPath, text)

  await fs.writeFile(path.join(targetDir, 'favicon.svg'), faviconSvg)
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(targetDir, 'og-cover.png'))
  await sharp(Buffer.from(faviconSvg)).resize(180, 180).png().toFile(path.join(targetDir, 'apple-touch-icon.png'))
  await sharp(Buffer.from(faviconSvg)).resize(192, 192).png().toFile(path.join(targetDir, 'pwa-192x192.png'))
  await sharp(Buffer.from(faviconSvg)).resize(512, 512).png().toFile(path.join(targetDir, 'pwa-512x512.png'))
  await sharp(Buffer.from(faviconSvg))
    .resize(512, 512)
    .extend({ top: 42, right: 42, bottom: 42, left: 42, background: voidBlack })
    .resize(512, 512)
    .png()
    .toFile(path.join(targetDir, 'pwa-maskable-512x512.png'))
  await fs.mkdir(path.join(targetDir, 'assets/brand'), { recursive: true })
  await sharp(Buffer.from(emailLockupSvg)).resize(258, 58).png().toFile(path.join(targetDir, 'assets/brand/silbo-email-lockup.png'))

  // Raster favicons. The browser tab uses favicon.svg, but Google Search (and other engines) use
  // favicon.ico / the PNG rel=icon links — so these MUST be regenerated from the current mark too,
  // or search results keep showing the old logo. (This is exactly that bug: they were stale.)
  for (const px of [16, 32, 48, 96]) {
    await sharp(Buffer.from(faviconSvg)).resize(px, px).png().toFile(path.join(targetDir, `favicon-${px}x${px}.png`))
  }
  const icoPng = await sharp(Buffer.from(faviconSvg)).resize(48, 48).png().toBuffer()
  await fs.writeFile(path.join(targetDir, 'favicon.ico'), pngToIco(icoPng, 48))
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  await writeBrandAssets(path.join(defaultRoot, 'public'))
  console.log('Generated Silbo favicon.svg, apple-touch-icon.png, and og-cover.png.')
}
