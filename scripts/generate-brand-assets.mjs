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
const ogCoverFilename = 'og-cover-2026-07-crt.png'

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
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8f3e8"/>
      <stop offset="0.5" stop-color="#f3ead9"/>
      <stop offset="1" stop-color="#e6f1ed"/>
    </linearGradient>
    <radialGradient id="greenGlow" cx="8%" cy="18%" r="68%">
      <stop offset="0" stop-color="#20d77b" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#20d77b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cyanGlow" cx="92%" cy="82%" r="68%">
      <stop offset="0" stop-color="#45c7d4" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#45c7d4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pinkGlow" cx="96%" cy="10%" r="50%">
      <stop offset="0" stop-color="#ef6baf" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#ef6baf" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffdf5" stop-opacity="0.94"/>
      <stop offset="1" stop-color="#f5eddd" stop-opacity="0.88"/>
    </linearGradient>
    <linearGradient id="heroTitle" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#103d31"/>
      <stop offset="0.76" stop-color="#155f40"/>
      <stop offset="1" stop-color="#39a964"/>
    </linearGradient>
    <pattern id="scanlines" width="6" height="6" patternUnits="userSpaceOnUse">
      <path d="M0 1H6" stroke="#235b4b" stroke-opacity="0.07"/>
    </pattern>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#278267" stroke-opacity="0.13"/>
    </pattern>
    <linearGradient id="gridFade" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="0.68" stop-color="#fff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="gridMask"><rect width="420" height="250" fill="url(#gridFade)"/></mask>
    <filter id="cardShadow" x="-10%" y="-15%" width="120%" height="135%">
      <feDropShadow dx="0" dy="13" stdDeviation="14" flood-color="#385649" flood-opacity="0.14"/>
    </filter>
    <filter id="signalGlow" x="-20%" y="-80%" width="140%" height="260%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#greenGlow)"/>
  <rect width="1200" height="630" fill="url(#cyanGlow)"/>
  <rect width="1200" height="630" fill="url(#pinkGlow)"/>
  <rect x="8" y="8" width="1184" height="614" rx="38" fill="none" stroke="#3b806b" stroke-opacity="0.18" stroke-width="10"/>
  <rect width="1200" height="630" rx="42" fill="url(#scanlines)"/>
  <g mask="url(#gridMask)">
    <rect x="12" y="88" width="420" height="250" fill="url(#grid)"/>
  </g>
  <g fill="none" stroke-linecap="round" filter="url(#signalGlow)">
    <path d="M8 326H72V307H109V344H146V317H197V326H264" stroke="#20d77b" stroke-opacity="0.34" stroke-width="2"/>
    <path d="M930 112c32-30 64-30 96 0s64 30 96 0 52-28 70-8" stroke="#ef6baf" stroke-opacity="0.30" stroke-width="2"/>
    <path d="M915 555c38-42 76-42 114 0s76 42 114 0" stroke="#45c7d4" stroke-opacity="0.34" stroke-width="2"/>
  </g>

  <g transform="translate(34 25)">
    <path transform="scale(0.105)" d="${logoPath}" fill="#176b49" fill-rule="evenodd"/>
    ${textPath(text.display, 'SILBO SPORTS', { x: 82, y: 4, size: 34, fill: '#176b49' })}
    ${textPath(text.mono, 'EVERY GAME, MATCH, RACE, AND CARD IN YOUR CALENDAR', { x: 83, y: 44, size: 10, fill: '#245446', opacity: 0.68 })}
    ${textPath(text.mono, 'SPORTS     MY SCHEDULE     CREATE LEAGUE', { x: 605, y: 19, size: 13, fill: '#234b40', opacity: 0.72 })}
  </g>

  <g transform="translate(34 90)">
    <rect width="1132" height="50" rx="14" fill="#fffaf0" fill-opacity="0.76" stroke="#b18428" stroke-opacity="0.34"/>
    ${textPath(text.mono, 'THIS WEEK', { x: 18, y: 18, size: 11, fill: '#a06c13' })}
    <circle cx="147" cy="25" r="4" fill="#f0b93f"/>
    ${textPath(text.sans, 'World Cup', { x: 160, y: 14, size: 14, fill: '#2a332f' })}
    ${textPath(text.mono, 'TODAY 3:00 PM', { x: 253, y: 18, size: 10, fill: '#58665f', opacity: 0.75 })}
    <circle cx="425" cy="25" r="4" fill="#20d77b"/>
    ${textPath(text.sans, 'Tour de France', { x: 438, y: 14, size: 14, fill: '#2a332f' })}
    <circle cx="753" cy="25" r="4" fill="#ef6baf"/>
    ${textPath(text.sans, 'England vs Argentina', { x: 766, y: 14, size: 14, fill: '#2a332f' })}
  </g>

  <g transform="translate(70 160)" filter="url(#cardShadow)">
    <rect width="760" height="410" rx="24" fill="url(#panel)" stroke="#176b49" stroke-opacity="0.26"/>
    ${textPath(text.mono, 'WHISTLE TO WHISTLE  /  IN YOUR TIMEZONE', { x: 32, y: 27, size: 12, fill: '#d53e8d' })}
    ${textPath(text.head, 'ONE SCHEDULE FOR', { x: 32, y: 65, size: 49, fill: 'url(#heroTitle)' })}
    ${textPath(text.head, 'EVERY SPORT YOU', { x: 32, y: 120, size: 49, fill: 'url(#heroTitle)' })}
    ${textPath(text.head, 'FOLLOW.', { x: 32, y: 175, size: 49, fill: '#2c9258' })}
    ${textPath(text.sans, 'Follow every team, country, player, driver, fighter, and league.', { x: 34, y: 242, size: 15, fill: '#465c54', opacity: 0.84 })}
    <g transform="translate(32 278)">
      <rect width="696" height="48" rx="12" fill="#f8f4e9" fill-opacity="0.78" stroke="#176b49" stroke-opacity="0.30"/>
      ${['YOU|11:30 PM|#20a862', 'LONDON|4:30 AM|#218ca7', 'TOKYO|12:30 PM|#d53e8d', 'SYDNEY|1:30 PM|#b77a12']
        .map((item, index) => {
          const [city, time, color] = item.split('|')
          const x = index * 174
          return `<g transform="translate(${x} 0)">
            ${index ? '<path d="M0 0V48" stroke="#176b49" stroke-opacity="0.18"/>' : ''}
            ${textPath(text.mono, city, { x: 87, y: 8, size: 8, fill: '#53665f', opacity: 0.76, anchor: 'top' })}
            ${textPath(text.sans, time, { x: 87, y: 23, size: 13, fill: color, anchor: 'top' })}
          </g>`
        })
        .join('')}
    </g>
    <rect x="32" y="342" width="450" height="38" rx="10" fill="#fffaf0" fill-opacity="0.88" stroke="#176b49" stroke-opacity="0.22"/>
    <circle cx="52" cy="361" r="6" fill="none" stroke="#63736d" stroke-width="2"/>
    <path d="M56 365l6 6" stroke="#63736d" stroke-width="2" stroke-linecap="round"/>
    ${textPath(text.sans, 'Search teams, leagues, players, and tournaments', { x: 72, y: 352, size: 12, fill: '#63736d', opacity: 0.72 })}
    <rect x="496" y="342" width="112" height="38" rx="10" fill="#fffdf8" stroke="#176b49" stroke-opacity="0.35"/>
    ${textPath(text.sans, 'Browse sports', { x: 514, y: 352, size: 12, fill: '#176b49' })}
    <rect x="618" y="342" width="110" height="38" rx="10" fill="#fffdf8" stroke="#176b49" stroke-opacity="0.35"/>
    ${textPath(text.sans, 'My schedule', { x: 637, y: 352, size: 12, fill: '#176b49' })}
  </g>

  <g transform="translate(850 160)" filter="url(#cardShadow)">
    <rect width="280" height="410" rx="24" fill="url(#panel)" stroke="#176b49" stroke-opacity="0.26"/>
    ${textPath(text.mono, 'YOUR NEXT EVENTS', { x: 22, y: 25, size: 14, fill: '#16834f' })}
    ${textPath(text.sans, 'America/Toronto local time', { x: 22, y: 50, size: 12, fill: '#53665f', opacity: 0.72 })}
    <g transform="translate(18 83)">
      <rect width="244" height="72" rx="12" fill="#f2ecdf" fill-opacity="0.88"/>
      ${textPath(text.sans, 'France vs Spain', { x: 14, y: 15, size: 15, fill: paperInk })}
      ${textPath(text.mono, 'TODAY 3:00 PM', { x: 14, y: 43, size: 10, fill: '#607068', opacity: 0.76 })}
    </g>
    <g transform="translate(18 166)">
      <rect width="244" height="72" rx="12" fill="#f2ecdf" fill-opacity="0.88"/>
      ${textPath(text.sans, 'England vs Argentina', { x: 14, y: 15, size: 15, fill: paperInk })}
      ${textPath(text.mono, 'TOMORROW 3:00 PM', { x: 14, y: 43, size: 10, fill: '#607068', opacity: 0.76 })}
    </g>
    ${textPath(text.sans, 'Continue to My Schedule  >', { x: 22, y: 270, size: 13, fill: '#16834f' })}
    <g transform="translate(22 323)">
      <rect width="15" height="15" rx="2" fill="#45c7d4" opacity="0.78"/>
      <rect x="23" y="4" width="9" height="9" rx="2" fill="#ef6baf" opacity="0.72"/>
      <rect x="40" y="-2" width="7" height="7" rx="2" fill="#f0b93f" opacity="0.78"/>
      <rect x="54" y="7" width="11" height="11" rx="2" fill="#20d77b" opacity="0.70"/>
    </g>
  </g>

  ${textPath(text.mono, 'SILBOSPORTS.COM', { x: 1015, y: 38, size: 12, fill: '#176b49' })}
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
