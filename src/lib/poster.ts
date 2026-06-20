// Canvas-rendered, high-resolution schedule poster export.
//
// The poster has a fixed "chrome" finish (locked decision: neon for UI, chrome for export
// posters) in two variants — light (warm paper) and dark (black + neon green) — so a user can
// save whichever reads better. Layout: glowing whistle header, followed-teams bar, one card per
// match (dark time block · title with coloured "vs" · meta · index number), and a footer.
import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import { formatDate, formatTimeParts } from './time'

export type PosterVariant = 'light' | 'dark'

type PosterPalette = {
  pageTop: string
  pageBottom: string
  fieldLine: string
  panelBg: string
  panelBorder: string
  logo: string
  logoSoft: string
  glow: string | null
  brandText: string
  headline: string
  tz: string
  teamText: string
  slash: string
  rowBg: string
  rowBorder: string
  timeBlock: string
  timeText: string
  zoneText: string
  dateText: string
  title: string
  vs: string
  subtitle: string
  number: string
  footerText: string
  footerSub: string
}

const PALETTES: Record<PosterVariant, PosterPalette> = {
  light: {
    pageTop: '#f3ecd9',
    pageBottom: '#ece3cd',
    fieldLine: 'rgba(21, 94, 56, 0.10)',
    panelBg: '#faf5e8',
    panelBorder: '#e6dcc4',
    logo: '#1c5d3a',
    logoSoft: '#46a06d',
    glow: null,
    brandText: '#1a5235',
    headline: '#23201a',
    tz: '#2f8f5b',
    teamText: '#21402c',
    slash: '#3a9d68',
    rowBg: '#faf6ec',
    rowBorder: '#e7ddc6',
    timeBlock: '#12512f',
    timeText: '#ffffff',
    zoneText: '#8ad6ac',
    dateText: '#d4e9dc',
    title: '#1d1812',
    vs: '#2f8f5b',
    subtitle: '#8f8970',
    number: '#cec7ac',
    footerText: '#23201a',
    footerSub: '#8f8970',
  },
  dark: {
    pageTop: '#081008',
    pageBottom: '#04080a',
    fieldLine: 'rgba(60, 224, 130, 0.12)',
    panelBg: '#0a120c',
    panelBorder: '#2c6f47',
    logo: '#3ce081',
    logoSoft: '#9bffc6',
    glow: 'rgba(60, 224, 130, 0.55)',
    brandText: '#3ef08a',
    headline: '#f1ece0',
    tz: '#48cc80',
    teamText: '#ece4d0',
    slash: '#48cc80',
    rowBg: '#0e1812',
    rowBorder: '#234e36',
    timeBlock: '#114a2c',
    timeText: '#ffffff',
    zoneText: '#8fe7b4',
    dateText: '#cfe9da',
    title: '#f1ece0',
    vs: '#46e08a',
    subtitle: '#88a896',
    number: '#3a5e48',
    footerText: '#f1ece0',
    footerSub: '#88a896',
  },
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, height / 2, width / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

// Rounded on the left corners only — the time block sits flush against the card on its right.
function roundRectLeft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, height / 2, width)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width, y)
  ctx.lineTo(x + width, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

// Draw "Team1 vs Team2" on one baseline, "vs" in the accent colour, shrinking the font to fit.
function drawTitle(
  ctx: CanvasRenderingContext2D,
  team1: string,
  team2: string,
  x: number,
  y: number,
  maxWidth: number,
  palette: PosterPalette,
) {
  let size = 66
  const fit = (s: number) => {
    ctx.font = `900 ${s}px Arial, sans-serif`
    const w1 = ctx.measureText(team1).width
    const w2 = ctx.measureText(team2).width
    ctx.font = `800 ${Math.round(s * 0.74)}px Arial, sans-serif`
    const wv = ctx.measureText(' vs ').width
    return w1 + wv + w2
  }
  while (size > 40 && fit(size) > maxWidth) size -= 2

  let cursor = x
  ctx.textAlign = 'left'
  ctx.font = `900 ${size}px Arial, sans-serif`
  ctx.fillStyle = palette.title
  ctx.fillText(team1, cursor, y)
  cursor += ctx.measureText(team1).width
  ctx.font = `800 ${Math.round(size * 0.74)}px Arial, sans-serif`
  ctx.fillStyle = palette.vs
  ctx.fillText(' vs ', cursor, y)
  cursor += ctx.measureText(' vs ').width
  ctx.font = `900 ${size}px Arial, sans-serif`
  ctx.fillStyle = palette.title
  ctx.fillText(team2, cursor, y)
}

function fitOneLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let truncated = text
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated.trimEnd()}…`
}

// A stylised referee whistle pointing left: body + mouthpiece + finger loop + sound waves.
function drawWhistle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  palette: PosterPalette,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  if (palette.glow) {
    ctx.shadowColor = palette.glow
    ctx.shadowBlur = 38
  }
  ctx.fillStyle = palette.logo
  // body
  roundRect(ctx, -54, -34, 96, 68, 30)
  ctx.fill()
  // mouthpiece
  roundRect(ctx, -104, -16, 58, 32, 14)
  ctx.fill()
  // finger loop
  ctx.lineWidth = 14
  ctx.strokeStyle = palette.logo
  ctx.beginPath()
  ctx.arc(6, -58, 22, 0, Math.PI * 2)
  ctx.stroke()
  // air hole highlight
  ctx.shadowBlur = 0
  ctx.fillStyle = palette.logoSoft
  ctx.beginPath()
  ctx.arc(2, 0, 13, 0, Math.PI * 2)
  ctx.fill()
  // sound waves
  ctx.strokeStyle = palette.logo
  ctx.lineWidth = 9
  for (let i = 1; i <= 3; i += 1) {
    ctx.beginPath()
    ctx.arc(58, -6, 14 + i * 16, -Math.PI / 2.6, Math.PI / 2.6)
    ctx.stroke()
  }
  ctx.restore()
}

// Faint soccer penalty-box lines in the top-right of the header.
function drawFieldMotif(ctx: CanvasRenderingContext2D, right: number, top: number, palette: PosterPalette) {
  ctx.save()
  ctx.strokeStyle = palette.fieldLine
  ctx.lineWidth = 6
  const boxW = 150
  const boxH = 230
  const x = right - boxW
  const y = top
  ctx.strokeRect(x, y + 30, boxW, boxH)
  ctx.strokeRect(x + 52, y + 92, boxW - 52, boxH - 124)
  ctx.beginPath()
  ctx.arc(x, y + 30 + boxH / 2, 46, -Math.PI / 2.2, Math.PI / 2.2)
  ctx.stroke()
  ctx.restore()
}

export type PosterPageInfo = { page: number; pageCount: number }

export function createScheduleCanvas(
  filteredMatches: Match[],
  selectedTeams: string[],
  timeZone: string,
  cityLabel: string,
  pageInfo?: PosterPageInfo,
  variant: PosterVariant = 'light',
  locale?: string,
  hour12?: boolean | null,
) {
  const p = PALETTES[variant] ?? PALETTES.light
  const timeOptions = { locale, hour12: hour12 ?? undefined }

  // Phone photo libraries rasterize saved images. Oversize the canvas so zooming in stays crisp.
  const width = 2160
  const M = 96
  const innerW = width - M * 2

  const headerTop = 78
  const headerH = 384
  const teamsTop = headerTop + headerH + 44
  const teamsH = 134
  const rowsTop = teamsTop + teamsH + 48
  const cardH = 250
  const cardGap = 34
  const rowStride = cardH + cardGap
  const rowsBottom = rowsTop + filteredMatches.length * rowStride - cardGap
  const footerGap = 36
  const footerH = 150
  const footerTop = rowsBottom + footerGap
  const height = footerTop + footerH + 78

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.textBaseline = 'alphabetic'

  // page background
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, p.pageTop)
  bg.addColorStop(1, p.pageBottom)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  // faint field grid
  ctx.strokeStyle = p.fieldLine
  ctx.lineWidth = 3
  for (let gx = M; gx <= width - M; gx += 120) {
    ctx.beginPath()
    ctx.moveTo(gx, headerTop)
    ctx.lineTo(gx, height - 78)
    ctx.stroke()
  }

  // ---- header panel ----
  ctx.save()
  if (p.glow) {
    ctx.shadowColor = p.glow
    ctx.shadowBlur = 26
  }
  ctx.fillStyle = p.panelBg
  roundRect(ctx, M, headerTop, innerW, headerH, 44)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = p.panelBorder
  ctx.lineWidth = 3
  roundRect(ctx, M, headerTop, innerW, headerH, 44)
  ctx.stroke()

  drawFieldMotif(ctx, width - M - 70, headerTop + 40, p)
  drawWhistle(ctx, M + 200, headerTop + headerH / 2, 1.5, p)

  const textX = M + 392
  ctx.textAlign = 'left'
  ctx.fillStyle = p.brandText
  if (p.glow) {
    ctx.save()
    ctx.shadowColor = p.glow
    ctx.shadowBlur = 22
  }
  ctx.font = '900 132px Arial, sans-serif'
  ctx.fillText(brand.appName.toUpperCase(), textX, headerTop + 168)
  if (p.glow) ctx.restore()
  ctx.fillStyle = p.headline
  ctx.font = '800 60px Arial, sans-serif'
  ctx.fillText('World Cup 2026 watch schedule', textX + 4, headerTop + 244)
  ctx.fillStyle = p.tz
  ctx.font = '700 42px Arial, sans-serif'
  const pageSuffix = pageInfo && pageInfo.pageCount > 1 ? `   ·   Page ${pageInfo.page} of ${pageInfo.pageCount}` : ''
  ctx.fillText(`${cityLabel} local time · ${timeZone}${pageSuffix}`, textX + 4, headerTop + 308)

  // ---- followed-teams bar ----
  ctx.fillStyle = p.panelBg
  roundRect(ctx, M, teamsTop, innerW, teamsH, 30)
  ctx.fill()
  ctx.strokeStyle = p.panelBorder
  ctx.lineWidth = 3
  roundRect(ctx, M, teamsTop, innerW, teamsH, 30)
  ctx.stroke()
  {
    const teams = selectedTeams.length ? selectedTeams : ['All confirmed group-stage teams']
    ctx.font = '900 50px Arial, sans-serif'
    ctx.textAlign = 'left'
    // measure to centre the whole "A / B / C" run
    let total = 0
    teams.forEach((team, i) => {
      total += ctx.measureText(team.toUpperCase()).width
      if (i < teams.length - 1) total += ctx.measureText('   /   ').width
    })
    let cx = Math.max(M + 40, M + innerW / 2 - total / 2)
    const baseY = teamsTop + teamsH / 2 + 18
    teams.forEach((team, i) => {
      ctx.fillStyle = p.teamText
      ctx.fillText(team.toUpperCase(), cx, baseY)
      cx += ctx.measureText(team.toUpperCase()).width
      if (i < teams.length - 1) {
        ctx.fillStyle = p.slash
        ctx.fillText('   /   ', cx, baseY)
        cx += ctx.measureText('   /   ').width
      }
    })
  }

  // ---- match rows ----
  filteredMatches.forEach((match, index) => {
    const y = rowsTop + index * rowStride
    // card
    ctx.fillStyle = p.rowBg
    roundRect(ctx, M, y, innerW, cardH, 30)
    ctx.fill()
    ctx.strokeStyle = p.rowBorder
    ctx.lineWidth = 3
    roundRect(ctx, M, y, innerW, cardH, 30)
    ctx.stroke()

    // time block (left, full card height, rounded-left)
    const timeW = 300
    ctx.fillStyle = p.timeBlock
    roundRectLeft(ctx, M, y, timeW, cardH, 30)
    ctx.fill()
    const tcx = M + timeW / 2
    const { clock, zone } = formatTimeParts(match.startsAt, timeZone, timeOptions)
    ctx.textAlign = 'center'
    ctx.fillStyle = p.timeText
    ctx.font = '900 62px Arial, sans-serif'
    ctx.fillText(clock, tcx, y + 96)
    ctx.fillStyle = p.zoneText
    ctx.font = '800 34px Arial, sans-serif'
    ctx.fillText(zone, tcx, y + 144)
    ctx.fillStyle = p.dateText
    ctx.font = '700 38px Arial, sans-serif'
    ctx.fillText(formatDate(match.startsAt, timeZone, timeOptions), tcx, y + 196)

    // index number (right)
    ctx.textAlign = 'right'
    ctx.fillStyle = p.number
    ctx.font = '900 76px Arial, sans-serif'
    ctx.fillText(String(index + 1).padStart(2, '0'), width - M - 46, y + cardH / 2 + 28)

    // title + meta
    const contentX = M + timeW + 48
    const numberLeft = width - M - 170
    const contentW = numberLeft - contentX
    drawTitle(ctx, match.team1, match.team2, contentX, y + 118, contentW, p)
    const meta = [match.group, match.round, match.ground].filter(Boolean).join('  -  ')
    ctx.textAlign = 'left'
    ctx.fillStyle = p.subtitle
    ctx.font = '600 38px Arial, sans-serif'
    ctx.fillText(fitOneLine(ctx, meta, contentW), contentX, y + 178)
  })

  // ---- footer ----
  ctx.fillStyle = p.panelBg
  roundRect(ctx, M, footerTop, innerW, footerH, 30)
  ctx.fill()
  ctx.strokeStyle = p.panelBorder
  ctx.lineWidth = 3
  roundRect(ctx, M, footerTop, innerW, footerH, 30)
  ctx.stroke()
  // bookmark glyph
  ctx.save()
  ctx.strokeStyle = p.tz
  ctx.lineWidth = 7
  const bx = M + 70
  const by = footerTop + 44
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(bx + 44, by)
  ctx.lineTo(bx + 44, by + 62)
  ctx.lineTo(bx + 22, by + 42)
  ctx.lineTo(bx, by + 62)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
  const fTextX = M + 170
  ctx.textAlign = 'left'
  ctx.fillStyle = p.footerText
  ctx.font = '800 46px Arial, sans-serif'
  ctx.fillText('Save this image to Photos and zoom in for kickoff details.', fTextX, footerTop + 70)
  ctx.fillStyle = p.footerSub
  ctx.font = '600 34px Arial, sans-serif'
  ctx.fillText(`Generated locally in your browser  ·  ${brand.domainHint}`, fTextX, footerTop + 116)

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not create schedule image.'))
      }
    }, 'image/png')
  })
}
