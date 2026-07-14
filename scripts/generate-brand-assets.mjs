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
const ogCoverFilename = 'og-cover-2026-07.png'

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
  const featureCards = [
    ['LOCAL TIME', 'Times in your timezone.'],
    ['WATCH + TICKETS', 'Broadcasters and ticket links.'],
    ['SYNC + EXPORT', 'Calendars, notes, exports.'],
    ['ALERTS', 'Follow teams, leagues, and stars.'],
  ]
  const sports = ['WORLD CUP', 'NBA', 'NFL', 'MLB', 'FORMULA 1', 'UFC', 'TENNIS', 'GOLF']

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#121713"/>
      <stop offset="0.52" stop-color="#171b18"/>
      <stop offset="1" stop-color="#07140d"/>
    </linearGradient>
    <radialGradient id="heroGlow" cx="72%" cy="45%" r="62%">
      <stop offset="0" stop-color="${brandGreen}" stop-opacity="0.18"/>
      <stop offset="0.38" stop-color="#35f5ff" stop-opacity="0.07"/>
      <stop offset="0.72" stop-color="#ff4fd8" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#07110b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="logoGrad" x1="70" y1="60" x2="220" y2="180" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#38eaff"/>
      <stop offset="0.44" stop-color="${brandGreen}"/>
      <stop offset="0.78" stop-color="#ff4fd8"/>
      <stop offset="1" stop-color="#ffc24b"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#212822"/>
      <stop offset="1" stop-color="#171b18"/>
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff8ea"/>
      <stop offset="1" stop-color="#efe2cc"/>
    </linearGradient>
    <filter id="softGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="4.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="cardShadow" x="-10%" y="-25%" width="120%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#000" flood-opacity="0.42"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#heroGlow)"/>
  <g opacity="0.11" stroke="${brandGreen}" stroke-width="1">
    ${Array.from({ length: 16 }, (_, i) => `<path d="M0 ${34 + i * 38}H1200"/>`).join('')}
    ${Array.from({ length: 22 }, (_, i) => `<path d="M${46 + i * 54} 0V630"/>`).join('')}
  </g>
  <g opacity="0.18" stroke="${warmPaper}" stroke-width="1.2">
    <path d="M945 78h162v162H945z"/>
    <path d="M986 78v162M1062 78v162M945 158h162M1024 118a42 42 0 0 0 0 82"/>
  </g>

  <g transform="translate(64 54)">
    <path transform="scale(0.138)" d="${logoPath}" fill="url(#logoGrad)" fill-rule="evenodd" filter="url(#softGlow)"/>
    ${textPath(text.display, 'SILBO SPORTS', { x: 104, y: 13, size: 43, fill: brandGreen })}
    ${textPath(text.mono, 'EVERY GAME, MATCH, RACE, AND CARD IN YOUR CALENDAR', { x: 106, y: 66, size: 14, fill: warmPaper, opacity: 0.72 })}
  </g>

  <g transform="translate(64 154)">
    ${textPath(text.head, 'ONE SCHEDULE', { x: 0, y: 0, size: 54, fill: warmPaper })}
    ${textPath(text.head, 'FOR EVERY SPORT', { x: 0, y: 62, size: 54, fill: warmPaper })}
    ${textPath(text.head, 'YOU FOLLOW.', { x: 0, y: 124, size: 54, fill: brandGreen })}
    <rect x="0" y="228" width="506" height="2" rx="1" fill="${brandGreen}" opacity="0.7"/>
    ${textPath(text.sans, 'Local times. Watch links. Tickets. Alerts.', { x: 0, y: 254, size: 22, fill: warmPaper, opacity: 0.82 })}
  </g>

  <g transform="translate(700 122)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="430" height="372" rx="28" fill="url(#panel)" stroke="${brandGreen}" stroke-opacity="0.45" stroke-width="2"/>
    <rect x="26" y="28" width="378" height="70" rx="16" fill="#101511" stroke="${brandGreen}" stroke-opacity="0.32"/>
    ${textPath(text.mono, 'LIVE SPORTS ROOM', { x: 52, y: 48, size: 17, fill: '#ff4fd8' })}
    ${textPath(text.head, 'Tonight and tomorrow', { x: 52, y: 70, size: 22, fill: warmPaper })}
    <g transform="translate(26 122)">
      ${featureCards
        .map(([label, body], index) => {
          const x = (index % 2) * 194
          const y = Math.floor(index / 2) * 104
          const accent = index === 1 ? '#35f5ff' : index === 2 ? '#ffc24b' : index === 3 ? '#ff4fd8' : brandGreen
          return `<g transform="translate(${x} ${y})">
        <rect x="0" y="0" width="178" height="88" rx="14" fill="#141a15" stroke="${accent}" stroke-opacity="0.42"/>
        <circle cx="22" cy="24" r="6" fill="${accent}"/>
        ${textPath(text.mono, label, { x: 38, y: 16, size: 12, fill: accent })}
        ${textPath(text.sans, body, { x: 18, y: 42, size: 12, fill: warmPaper, opacity: 0.72 })}
      </g>`
        })
        .join('')}
    </g>
  </g>

  <g transform="translate(64 548)">
    <rect x="0" y="0" width="1066" height="50" rx="16" fill="#0d130f" stroke="${brandGreen}" stroke-opacity="0.35"/>
    ${sports
      .map((sport, index) => {
        const x = 32 + index * 128
        const color = index % 4 === 0 ? brandGreen : index % 4 === 1 ? '#35f5ff' : index % 4 === 2 ? '#ffc24b' : '#ff4fd8'
        return `<g transform="translate(${x} 16)">
          <circle cx="0" cy="8" r="4" fill="${color}"/>
          ${textPath(text.mono, sport, { x: 14, y: 0, size: 14, fill: warmPaper, opacity: 0.82 })}
        </g>`
      })
      .join('')}
  </g>

  ${textPath(text.mono, 'SILBOSPORTS.COM', { x: 934, y: 46, size: 16, fill: brandGreen })}
</svg>
`
}

export function ogCoverFileName() {
  return ogCoverFilename
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
  const ogPng = await sharp(Buffer.from(ogSvg)).png().toBuffer()
  await fs.writeFile(path.join(targetDir, 'og-cover.png'), ogPng)
  await fs.writeFile(path.join(targetDir, ogCoverFilename), ogPng)
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
  console.log(`Generated Silbo favicon.svg, apple-touch-icon.png, og-cover.png, and ${ogCoverFilename}.`)
}
