// Canvas-rendered, high-resolution schedule poster export.
//
import type { Match } from '../domain/match'
import { brand } from '../domain/brand'
import { posterChromeTheme, type SportTheme } from '../theme/themes'
import { formatDate, formatTimeParts } from './time'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let cursorY = y

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY)
      line = word
      cursorY += lineHeight
    } else {
      line = testLine
    }
  })

  if (line) ctx.fillText(line, x, cursorY)
  return cursorY
}

export type PosterPageInfo = { page: number; pageCount: number }

export function createScheduleCanvas(
  filteredMatches: Match[],
  selectedTeams: string[],
  timeZone: string,
  cityLabel: string,
  pageInfo?: PosterPageInfo,
  theme: SportTheme = posterChromeTheme,
  locale?: string,
  hour12?: boolean | null,
) {
  // Phone photo libraries rasterize saved images. Use a deliberately oversized canvas so
  // zooming in feels close to vector/PDF quality without leaving the familiar Photos flow.
  const width = 2160
  const rowHeight = 260
  const height = Math.max(2880, 700 + filteredMatches.length * rowHeight + 360)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const { colors } = theme
  const timeOptions = { locale, hour12: hour12 ?? undefined }

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, colors.surface)
  bg.addColorStop(0.52, colors.bg)
  bg.addColorStop(1, `${colors.secondary}4d`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = colors.primary
  ctx.globalAlpha = 0.08
  for (let x = 0; x < width; x += 180) {
    ctx.fillRect(x, 0, 56, height)
  }
  ctx.globalAlpha = 1

  ctx.strokeStyle = `${colors.primary}33`
  ctx.lineWidth = 8
  ctx.strokeRect(110, 430, width - 220, height - 610)
  ctx.beginPath()
  ctx.moveTo(width / 2, 430)
  ctx.lineTo(width / 2, height - 180)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(width / 2, 780, 260, 0, Math.PI * 2)
  ctx.stroke()

  const header = ctx.createLinearGradient(110, 96, width - 110, 350)
  header.addColorStop(0, colors.text)
  header.addColorStop(0.62, colors.primary)
  header.addColorStop(1, colors.accent)
  ctx.fillStyle = header
  roundRect(ctx, 110, 96, width - 220, 300, 48)
  ctx.fill()

  ctx.fillStyle = colors.secondary
  ctx.beginPath()
  ctx.arc(width - 260, 246, 78, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = colors.text
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = colors.text
  ctx.beginPath()
  ctx.arc(width - 260, 246, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = colors.text
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(width - 260, 168)
  ctx.lineTo(width - 260, 324)
  ctx.moveTo(width - 338, 246)
  ctx.lineTo(width - 182, 246)
  ctx.stroke()

  ctx.fillStyle = colors.surface
  ctx.font = '900 120px Arial, sans-serif'
  ctx.fillText(brand.appName, 176, 226)
  ctx.font = '700 48px Arial, sans-serif'
  ctx.fillText('World Cup 2026 watch schedule', 182, 292)
  ctx.font = '700 38px Arial, sans-serif'
  ctx.fillStyle = colors.secondary
  const pageSuffix = pageInfo && pageInfo.pageCount > 1 ? `  -  Page ${pageInfo.page} of ${pageInfo.pageCount}` : ''
  ctx.fillText(`${cityLabel} local time - ${timeZone}${pageSuffix}`, 182, 350)

  ctx.fillStyle = colors.text
  ctx.font = '900 52px Arial, sans-serif'
  const teamLabel = selectedTeams.length ? selectedTeams.join('  /  ') : 'All confirmed group-stage teams'
  wrapCanvasText(ctx, teamLabel, 132, 500, width - 264, 62)

  filteredMatches.forEach((match, index) => {
    const y = 620 + index * rowHeight
    ctx.fillStyle = index % 2 === 0 ? `${colors.surface}e6` : `${colors.bg}e8`
    roundRect(ctx, 110, y, width - 220, rowHeight - 36, 34)
    ctx.fill()
    ctx.strokeStyle = `${colors.primary}33`
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = colors.primary
    roundRect(ctx, 150, y + 42, 330, 150, 28)
    ctx.fill()
    ctx.fillStyle = colors.secondary
    ctx.font = '900 52px Arial, sans-serif'
    // formatToParts, not string-splitting: locale and 12/24h settings change the shape of
    // a formatted time, so splitting on spaces breaks outside en-US.
    const { clock, zone } = formatTimeParts(match.startsAt, timeZone, timeOptions)
    ctx.fillText(clock, 190, y + 98)
    ctx.font = '900 40px Arial, sans-serif'
    ctx.fillText(zone, 190, y + 146)
    ctx.fillStyle = colors.surface
    ctx.font = '800 34px Arial, sans-serif'
    ctx.fillText(formatDate(match.startsAt, timeZone, timeOptions), 190, y + 178)

    ctx.fillStyle = colors.text
    ctx.font = '900 62px Arial, sans-serif'
    const titleBottom = wrapCanvasText(ctx, `${match.team1} vs ${match.team2}`, 550, y + 82, 1180, 72)
    ctx.fillStyle = colors.primary
    ctx.font = '700 36px Arial, sans-serif'
    wrapCanvasText(
      ctx,
      `${match.group ?? ''} - ${match.round} - ${match.ground}`,
      554,
      Math.max(y + 164, titleBottom + 52),
      1280,
      44,
    )

    ctx.fillStyle = colors.accent
    ctx.font = '900 54px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(index + 1).padStart(2, '0'), width - 170, y + 96)
    ctx.textAlign = 'left'
  })

  const footerY = height - 170
  ctx.fillStyle = colors.text
  roundRect(ctx, 110, footerY - 64, width - 220, 150, 30)
  ctx.fill()
  ctx.fillStyle = colors.surface
  ctx.font = '800 42px Arial, sans-serif'
  ctx.fillText('Save this image to Photos and zoom in for kickoff details.', 170, footerY + 4)
  ctx.fillStyle = colors.secondary
  ctx.font = '700 32px Arial, sans-serif'
  ctx.fillText(`Generated locally in your browser - ${brand.domainHint}`, 170, footerY + 58)

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
