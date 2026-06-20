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
    slash: '#46e8ff',
    rowBg: '#0e1812',
    rowBorder: '#234e36',
    timeBlock: '#114a2c',
    timeText: '#ffffff',
    zoneText: '#7fdcef',
    dateText: '#cfe9da',
    title: '#f1ece0',
    vs: '#46e08a',
    subtitle: '#88a896',
    number: '#3f8a93',
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

// The real Silbo whistle mark (traced path from public/assets/brand/silbo-whistle-trace.svg),
// embedded so the poster renders offline. viewBox 642 x 516.
const LOGO_VIEW = { w: 642, h: 516 }
const LOGO_PATH =
  'M 347 89.612 C 315.774 93.240, 304.768 95.150, 284.500 100.462 C 233.338 113.868, 188.907 138.742, 169.050 165.094 C 152.866 186.571, 149.707 208.161, 159.698 229 C 163.018 235.924, 177.644 251, 181.041 251 C 182.306 251, 191.026 246.439, 200.420 240.864 C 237.544 218.834, 251 210.591, 251 209.879 C 251 209.469, 250.142 208.862, 249.092 208.529 C 246.342 207.656, 239.105 199.495, 237.344 195.280 C 232.802 184.410, 237.699 170.462, 250.580 157.581 C 275.834 132.327, 326.737 112.254, 385.500 104.377 C 403.238 101.999, 445.039 101.974, 463.845 104.329 C 479.456 106.284, 479.713 106.297, 478.450 105.097 C 477.204 103.913, 459.005 98.760, 446.502 96.051 C 424.302 91.241, 409.951 89.841, 379.500 89.516 C 363.550 89.345, 348.925 89.388, 347 89.612 M 502.115 126.537 C 498.752 130.132, 496 133.576, 496 134.191 C 496 134.806, 499.767 138.952, 504.371 143.405 C 530.020 168.209, 545.013 203.621, 544.994 239.349 C 544.983 260.928, 540.607 279.928, 531.257 299 C 528.157 305.325, 525.635 310.725, 525.653 311 C 525.727 312.101, 538.645 318.962, 540.678 318.980 C 542.270 318.995, 543.786 317.454, 546.317 313.250 C 558.671 292.732, 564.737 273.684, 567.075 248.065 C 569.962 216.425, 561.274 183.271, 542.556 154.500 C 532.149 138.503, 514.786 120, 510.181 120 C 509.068 120, 505.602 122.808, 502.115 126.537 M 469.528 156.509 C 465.938 160.153, 463.012 163.891, 463.026 164.817 C 463.040 165.743, 465.299 168.025, 468.046 169.888 C 478.987 177.310, 491.454 193.853, 497.099 208.441 C 502.662 222.815, 504.266 232.612, 503.659 248.500 C 503.030 264.978, 500.227 276.793, 494.098 288.807 C 492.944 291.070, 492 293.179, 492 293.496 C 492 293.813, 495.675 295.849, 500.166 298.021 C 506.613 301.139, 508.629 301.723, 509.744 300.798 C 513.272 297.870, 520.631 278.967, 523.322 265.922 C 529.751 234.750, 522.783 201.760, 504.215 175.462 C 496.357 164.333, 483.736 152.215, 478.278 150.558 C 476.455 150.004, 474.887 151.070, 469.528 156.509 M 354 180.009 C 327.448 183.657, 308.531 191.099, 273.500 211.677 C 264.150 217.170, 232.425 235.840, 203 253.167 C 140.804 289.790, 110.593 307.342, 106.805 309.053 C 105.323 309.723, 103.889 310.846, 103.620 311.548 C 102.967 313.249, 113.898 356.178, 115.359 357.651 C 116.526 358.829, 163.629 379.106, 183.923 387.168 C 194.945 391.546, 194.928 391.624, 188.504 366.017 C 183.696 346.851, 183.390 344.961, 184.876 343.660 C 185.769 342.878, 199.550 333.266, 215.500 322.300 C 274.070 282.031, 289.960 270.966, 311.500 255.454 C 346.041 230.578, 353.859 225.173, 363.653 219.396 C 382.741 208.137, 401.070 203.447, 416.747 205.809 C 427.767 207.469, 439.328 213.427, 446.442 221.110 C 449.416 224.323, 452.139 227.863, 452.492 228.976 C 453.481 232.089, 454.968 231.375, 454.064 228.222 C 450.337 215.228, 436.276 202.289, 421.650 198.395 C 413.951 196.345, 398.791 196.628, 389.410 198.998 C 378.950 201.640, 362.326 209.853, 347.368 219.770 C 335.502 227.637, 330.086 231.395, 282 265.126 C 221.116 307.835, 184.954 332.133, 182.745 331.816 C 180.872 331.547, 181.578 330.761, 187 327.074 C 190.575 324.643, 197.718 319.542, 202.874 315.737 C 210.667 309.987, 212.017 308.604, 210.874 307.539 C 210.118 306.835, 199.938 301.820, 188.250 296.394 C 176.563 290.969, 167 286.203, 167 285.803 C 167 285.403, 172.512 281.845, 179.250 277.895 C 185.988 273.945, 199.600 265.896, 209.500 260.009 C 238.462 242.786, 282.746 216.765, 292.651 211.150 C 310.340 201.123, 327.155 194.394, 344.280 190.489 C 364.051 185.980, 390.148 184.709, 405.931 187.487 C 410.569 188.303, 414.570 188.763, 414.823 188.510 C 415.677 187.656, 405.601 183.889, 397.022 181.856 C 387.271 179.544, 364.496 178.566, 354 180.009 M 443.021 184.479 C 440.603 186.943, 438.822 189.120, 439.062 189.317 C 439.303 189.514, 441.540 191.054, 444.034 192.737 C 446.528 194.421, 451.553 198.963, 455.202 202.831 C 472.605 221.279, 477.810 249.841, 468.527 275.955 C 467.656 278.406, 467.162 280.979, 467.428 281.674 C 467.695 282.368, 469.592 283.638, 471.644 284.496 C 476.248 286.419, 476.810 285.932, 480.299 277 C 490.485 250.923, 487.145 221.263, 471.583 199.607 C 465.179 190.695, 452.932 180, 449.132 180 C 448.188 180, 445.438 182.016, 443.021 184.479 M 390.300 215.506 C 380.212 217.699, 367.109 225.108, 358.739 233.352 C 344.618 247.262, 337.305 262.614, 336.296 280.466 C 335.829 288.736, 336.105 291.987, 337.869 298.959 C 342.529 317.378, 354.582 330.433, 372.001 335.931 C 385.401 340.160, 402.627 337.595, 416.246 329.342 C 432.224 319.660, 444.584 302.804, 449.538 283.942 C 451.640 275.936, 451.919 260.346, 450.092 253 C 443.125 225.002, 418.284 209.425, 390.300 215.506 M 391.721 226.505 C 372.825 231.284, 356.472 246.640, 350.366 265.338 C 347.016 275.595, 346.611 289.290, 349.391 298.319 C 351.735 305.934, 358.420 315.588, 364.249 319.774 C 386.623 335.846, 417.839 324.629, 433.481 294.897 C 441.473 279.705, 442.133 259.957, 435.107 246.220 C 427.230 230.815, 408.439 222.277, 391.721 226.505 M 348.863 231.513 C 345.681 233.242, 337.850 243.035, 332.338 252.177 C 323.238 267.274, 319.745 287.768, 323.442 304.384 C 328.364 326.505, 344.787 344.475, 366.165 351.128 C 369.472 352.158, 373.938 353, 376.089 353 C 378.240 353, 380 353.399, 380 353.887 C 380 355.934, 366.065 357.498, 348.500 357.423 C 332.178 357.354, 329.579 357.094, 320.615 354.641 C 315.178 353.154, 310.547 352.120, 310.322 352.345 C 309.658 353.009, 322.241 357.769, 330.681 360.046 C 341.797 363.046, 361.487 363.748, 374 361.592 C 398.521 357.366, 421.880 345.769, 438.194 329.723 C 444.930 323.097, 453.765 311.432, 452.787 310.454 C 452.562 310.229, 450.712 312.227, 448.678 314.896 C 440.571 325.525, 424.944 337.176, 411.845 342.356 C 404.020 345.450, 392.587 348.007, 386.685 347.983 C 379.758 347.954, 369.002 345.223, 361.176 341.506 C 351.781 337.045, 341.093 326.721, 337.532 318.667 C 330.961 303.810, 330.131 287.657, 334.988 269.186 C 338.625 255.353, 340.522 250.969, 347.356 240.589 C 350.285 236.140, 353.005 231.938, 353.400 231.250 C 354.356 229.586, 352.176 229.713, 348.863 231.513 M 144.626 298.564 C 136.996 303.120, 130.306 307.294, 129.761 307.839 C 128.496 309.104, 129.993 309.867, 154.581 320.497 L 174.394 329.063 183.447 322.856 C 194.636 315.184, 200 311.053, 200 310.108 C 200 309.710, 198.088 308.547, 195.750 307.523 C 193.412 306.500, 186.325 303.212, 180 300.218 C 173.675 297.224, 166.250 293.764, 163.500 292.528 L 158.500 290.281 144.626 298.564 M 463.712 310.700 C 460.806 344.387, 430.206 374.605, 378 395.341 C 313.050 421.139, 221.229 423.561, 148.147 401.405 C 143.553 400.012, 139.550 399.117, 139.251 399.415 C 138.333 400.333, 155.798 407.905, 169.500 412.529 C 204.432 424.318, 237.589 429.667, 282 430.678 C 309.797 431.311, 330.639 430.215, 353.500 426.917 C 412.600 418.392, 463.889 398.707, 488.231 375.207 C 496.638 367.091, 500.477 361.201, 502.494 353.328 C 504.325 346.185, 503.533 340.979, 499.353 332.675 C 495.867 325.749, 484.110 314.500, 474.922 309.299 C 463.695 302.944, 464.388 302.857, 463.712 310.700 M 113.340 319.599 C 113.654 320.644, 115.534 328.025, 117.517 336 C 119.501 343.975, 121.658 351.032, 122.312 351.682 C 122.965 352.332, 133.625 357.216, 146 362.537 C 158.375 367.857, 172.037 373.742, 176.361 375.615 C 181.095 377.665, 184.021 378.496, 183.717 377.704 C 183.439 376.982, 181.805 370.115, 180.084 362.445 C 176.742 347.551, 175.592 344, 174.109 344 C 173.595 344, 160.198 338.328, 144.337 331.396 C 128.477 324.464, 114.886 318.546, 114.135 318.245 C 113.170 317.858, 112.937 318.256, 113.340 319.599 M 284.168 321.533 C 271.321 324.322, 259.360 331.437, 216.500 361.787 C 199.170 374.059, 198.489 374.671, 198.192 378.224 C 197.857 382.244, 199.355 386, 201.293 386 C 201.965 386, 207.012 382.988, 212.508 379.306 C 236.196 363.437, 260.215 348.317, 269.500 343.431 C 292.933 331.100, 308.767 330.171, 329.551 339.911 C 334.279 342.126, 338.001 343.571, 337.823 343.122 C 337.645 342.672, 334.383 339.550, 330.574 336.184 C 322.087 328.684, 312.215 323.365, 303.257 321.467 C 295.102 319.739, 292.393 319.748, 284.168 321.533'

function loadTintedLogo(color: string): Promise<HTMLImageElement | null> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_VIEW.w}" height="${LOGO_VIEW.h}" viewBox="0 0 ${LOGO_VIEW.w} ${LOGO_VIEW.h}">` +
    `<path d="${LOGO_PATH}" fill="${color}" fill-rule="evenodd"/></svg>`
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  targetH: number,
  glow: string | null,
) {
  if (!img) return
  const w = targetH * (LOGO_VIEW.w / LOGO_VIEW.h)
  ctx.save()
  if (glow) {
    ctx.shadowColor = glow
    ctx.shadowBlur = 34
  }
  ctx.drawImage(img, cx - w / 2, cy - targetH / 2, w, targetH)
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

export async function createScheduleCanvas(
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
  const logo = await loadTintedLogo(p.logo)

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
  drawLogo(ctx, logo, M + 178, headerTop + headerH / 2, 168, p.glow)

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
  // small logo mark bookending the footer
  drawLogo(ctx, logo, M + 78, footerTop + footerH / 2, 84, p.glow)
  const fTextX = M + 156
  ctx.textAlign = 'left'
  ctx.fillStyle = p.footerText
  ctx.font = '800 46px Arial, sans-serif'
  ctx.fillText(brand.tagline, fTextX, footerTop + 70)
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
