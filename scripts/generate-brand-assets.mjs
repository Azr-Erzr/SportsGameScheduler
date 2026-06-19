import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const defaultRoot = process.cwd()
const brandGreen = '#4dff8a'
const warmPaper = '#f4ead8'
const voidBlack = '#0b0a08'

function extractLogoPath(svg) {
  const match = svg.match(/<path\s+d="([^"]+)"/)
  if (!match) throw new Error('Could not find Silbo logo path data.')
  return match[1]
}

async function readLogoPath(rootDir) {
  const svg = await fs.readFile(path.join(rootDir, 'public/assets/brand/silbo-whistle-trace.svg'), 'utf8')
  return extractLogoPath(svg)
}

export function createFaviconSvg(logoPath) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <defs>
    <linearGradient id="mark" x1="8" y1="14" x2="64" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#40f0ff"/>
      <stop offset="0.52" stop-color="${brandGreen}"/>
      <stop offset="1" stop-color="#ffc24b"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="54%" r="54%">
      <stop offset="0" stop-color="${brandGreen}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${brandGreen}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-35%" y="-45%" width="170%" height="190%">
      <feGaussianBlur stdDeviation="1.7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="72" height="72" rx="16" fill="${voidBlack}"/>
  <rect width="72" height="72" rx="16" fill="url(#halo)"/>
  <path transform="translate(5.2 10.8) scale(0.096)" d="${logoPath}" fill="url(#mark)" fill-rule="evenodd" filter="url(#glow)"/>
</svg>
`
}

export function createOgCoverSvg(logoPath) {
  const fixtureRows = [
    ['World Cup 2026', 'follow countries, kickoff changes'],
    ['F1 race weekends', 'practice, sprint, qualifying, race'],
    ['UFC / PFL fight cards', 'main cards, prelims, late swaps'],
  ]

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070806"/>
      <stop offset="0.42" stop-color="#11100c"/>
      <stop offset="1" stop-color="#082313"/>
    </linearGradient>
    <radialGradient id="greenHalo" cx="75%" cy="26%" r="58%">
      <stop offset="0" stop-color="${brandGreen}" stop-opacity="0.72"/>
      <stop offset="0.45" stop-color="#35f5ff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#07110b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="logoGrad" x1="665" y1="92" x2="1120" y2="445" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#38eaff"/>
      <stop offset="0.44" stop-color="${brandGreen}"/>
      <stop offset="0.75" stop-color="#ff4fd8"/>
      <stop offset="1" stop-color="#ffc24b"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f6efdf"/>
      <stop offset="1" stop-color="#fffaf0"/>
    </linearGradient>
    <filter id="softGlow" x="-35%" y="-35%" width="170%" height="170%">
      <feGaussianBlur stdDeviation="9" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#greenHalo)"/>
  <g opacity="0.13" stroke="${warmPaper}" stroke-width="1">
    ${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${48 + i * 34}H1200"/>`).join('')}
    ${Array.from({ length: 24 }, (_, i) => `<path d="M${26 + i * 52} 0V630"/>`).join('')}
  </g>
  <g transform="translate(66 58)">
    <text x="0" y="0" dominant-baseline="hanging" font-family="Arial Black, Arial, sans-serif" font-size="38" fill="${brandGreen}" letter-spacing="5">SILBO SPORTS</text>
    <text x="0" y="104" font-family="Arial Black, Arial, sans-serif" font-size="72" fill="${warmPaper}">Every game, match,</text>
    <text x="0" y="188" font-family="Arial Black, Arial, sans-serif" font-size="72" fill="${warmPaper}">race, and card</text>
    <text x="0" y="272" font-family="Arial Black, Arial, sans-serif" font-size="72" fill="${brandGreen}">in your calendar.</text>
    <text x="4" y="350" font-family="Arial, sans-serif" font-weight="700" font-size="29" fill="${warmPaper}" opacity="0.8">Live calendar feeds, poster exports, reminders, and shareable watch boards.</text>
  </g>
  <g transform="translate(790 132)">
    <path transform="scale(0.5)" d="${logoPath}" fill="url(#logoGrad)" fill-rule="evenodd" filter="url(#softGlow)"/>
  </g>
  <g transform="translate(68 474)">
    ${fixtureRows
      .map(
        ([title, body], index) => `<g transform="translate(${index * 354} 0)">
      <rect width="316" height="94" rx="18" fill="url(#card)" opacity="0.96"/>
      <rect x="0.5" y="0.5" width="315" height="93" rx="17.5" fill="none" stroke="${brandGreen}" stroke-opacity="0.42"/>
      <text x="22" y="36" font-family="Arial Black, Arial, sans-serif" font-size="22" fill="#09130c">${title}</text>
      <text x="22" y="66" font-family="Arial, sans-serif" font-size="17" fill="#354238">${body}</text>
    </g>`,
      )
      .join('')}
  </g>
  <text x="1084" y="584" text-anchor="end" font-family="Arial, sans-serif" font-weight="700" font-size="22" fill="${warmPaper}" opacity="0.72">silbosports.com</text>
</svg>
`
}

export async function writeBrandAssets(targetDir, { rootDir = defaultRoot } = {}) {
  await fs.mkdir(targetDir, { recursive: true })
  const logoPath = await readLogoPath(rootDir)
  const faviconSvg = createFaviconSvg(logoPath)
  const ogSvg = createOgCoverSvg(logoPath)

  await fs.writeFile(path.join(targetDir, 'favicon.svg'), faviconSvg)
  await sharp(Buffer.from(ogSvg)).png().toFile(path.join(targetDir, 'og-cover.png'))
  await sharp(Buffer.from(faviconSvg)).resize(180, 180).png().toFile(path.join(targetDir, 'apple-touch-icon.png'))
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  await writeBrandAssets(path.join(defaultRoot, 'public'))
  console.log('Generated Silbo favicon.svg, apple-touch-icon.png, and og-cover.png.')
}
