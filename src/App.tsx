import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Download,
  FileImage,
  Globe2,
  Mail,
  MapPin,
  MessageSquareText,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'
import worldCup from './data/worldcup2026.json'
import './App.css'

type RawMatch = {
  round: string
  num?: number
  date: string
  time: string
  team1: string
  team2: string
  group?: string
  ground: string
}

type Match = RawMatch & {
  startsAt: Date
}

type AlertState = {
  email: string
  phone: string
  channel: 'email' | 'text'
  leadTime: string
}

const cityOptions = [
  { label: 'Toronto', zone: 'America/Toronto' },
  { label: 'New York', zone: 'America/New_York' },
  { label: 'Los Angeles', zone: 'America/Los_Angeles' },
  { label: 'Mexico City', zone: 'America/Mexico_City' },
  { label: 'Vancouver', zone: 'America/Vancouver' },
  { label: 'London', zone: 'Europe/London' },
  { label: 'Paris', zone: 'Europe/Paris' },
  { label: 'Dubai', zone: 'Asia/Dubai' },
  { label: 'Tokyo', zone: 'Asia/Tokyo' },
  { label: 'Sydney', zone: 'Australia/Sydney' },
]

const featuredTeams = ['Canada', 'USA', 'Mexico', 'Argentina', 'Brazil', 'England', 'France', 'Portugal']

const knownTeamPattern = /^(?:\d[A-L]|W\d+|L\d+|\d[A-L]\/|3[A-L])/

function isKnownTeam(team: string) {
  return !knownTeamPattern.test(team)
}

function parseKickoff(date: string, time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})$/)
  if (!match) return new Date(`${date}T00:00:00Z`)

  const [, rawHour, rawMinute, rawOffset] = match
  const [year, month, day] = date.split('-').map(Number)
  const hour = Number(rawHour)
  const minute = Number(rawMinute)
  const offset = Number(rawOffset)

  return new Date(Date.UTC(year, month - 1, day, hour - offset, minute))
}

const matches: Match[] = (worldCup.matches as RawMatch[]).map((match) => ({
  ...match,
  startsAt: parseKickoff(match.date, match.time),
}))

const groupMatches = matches.filter((match) => isKnownTeam(match.team1) && isKnownTeam(match.team2))
const teams = Array.from(new Set(groupMatches.flatMap((match) => [match.team1, match.team2]))).sort((a, b) =>
  a.localeCompare(b),
)

function formatDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(date)
}

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(date)
}

function formatLongDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(date)
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function createIcsBlob(filteredMatches: Match[], timeZone: string) {
  const body = filteredMatches
    .map((match, index) => {
      const end = new Date(match.startsAt.getTime() + 2 * 60 * 60 * 1000)
      const title = `${match.team1} vs ${match.team2}`
      const description = `${match.round}${match.group ? `, ${match.group}` : ''}. Local kickoff: ${formatLongDate(
        match.startsAt,
        timeZone,
      )} at ${formatTime(match.startsAt, timeZone)}.`

      return [
        'BEGIN:VEVENT',
        `UID:matchpulse-${match.date}-${slug(match.team1)}-${slug(match.team2)}-${index}@local`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${formatIcsDate(match.startsAt)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${title}`,
        `LOCATION:${match.ground}`,
        `DESCRIPTION:${description}`,
        'END:VEVENT',
      ].join('\r\n')
    })
    .join('\r\n')

  const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MatchPulse//World Cup Scheduler//EN', body, 'END:VCALENDAR'].join(
    '\r\n',
  )
  return new Blob([calendar], { type: 'text/calendar;charset=utf-8' })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
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

function createScheduleCanvas(filteredMatches: Match[], selectedTeams: string[], timeZone: string, cityLabel: string) {
  const width = 1440
  const rowHeight = 210
  const height = Math.max(1900, 520 + filteredMatches.length * rowHeight + 250)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, width, height)
  bg.addColorStop(0, '#f6fff5')
  bg.addColorStop(0.4, '#dff8e7')
  bg.addColorStop(1, '#b6f1cf')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#0f6d35'
  ctx.globalAlpha = 0.08
  for (let x = -width; x < width * 1.3; x += 112) {
    ctx.fillRect(x, 0, 58, height)
    ctx.translate(112, 0)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1

  ctx.strokeStyle = 'rgba(15, 109, 53, 0.22)'
  ctx.lineWidth = 6
  ctx.strokeRect(74, 320, width - 148, height - 440)
  ctx.beginPath()
  ctx.moveTo(width / 2, 320)
  ctx.lineTo(width / 2, height - 120)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(width / 2, 620, 190, 0, Math.PI * 2)
  ctx.stroke()

  const header = ctx.createLinearGradient(74, 74, width - 74, 270)
  header.addColorStop(0, '#093a24')
  header.addColorStop(0.62, '#0d7a3e')
  header.addColorStop(1, '#16d995')
  ctx.fillStyle = header
  roundRect(ctx, 74, 74, width - 148, 226, 36)
  ctx.fill()

  ctx.fillStyle = '#d8ff49'
  ctx.beginPath()
  ctx.arc(1260, 188, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#07351d'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.fillStyle = '#07351d'
  ctx.beginPath()
  ctx.arc(1260, 188, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#07351d'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(1260, 130)
  ctx.lineTo(1260, 246)
  ctx.moveTo(1202, 188)
  ctx.lineTo(1318, 188)
  ctx.stroke()

  ctx.fillStyle = '#f8fff4'
  ctx.font = '900 82px Arial, sans-serif'
  ctx.fillText('MatchPulse', 124, 170)
  ctx.font = '700 34px Arial, sans-serif'
  ctx.fillText('World Cup 2026 watch schedule', 128, 222)
  ctx.font = '700 28px Arial, sans-serif'
  ctx.fillStyle = '#d8ff49'
  ctx.fillText(`${cityLabel} local time - ${timeZone}`, 128, 264)

  ctx.fillStyle = '#0b2819'
  ctx.font = '900 38px Arial, sans-serif'
  const teamLabel = selectedTeams.length ? selectedTeams.join('  /  ') : 'All confirmed group-stage teams'
  wrapCanvasText(ctx, teamLabel, 92, 372, width - 184, 46)

  filteredMatches.forEach((match, index) => {
    const y = 450 + index * rowHeight
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(236, 255, 241, 0.93)'
    roundRect(ctx, 74, y, width - 148, rowHeight - 30, 28)
    ctx.fill()
    ctx.strokeStyle = 'rgba(8, 85, 41, 0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#0b6f37'
    roundRect(ctx, 104, y + 34, 230, 126, 22)
    ctx.fill()
    ctx.fillStyle = '#d8ff49'
    ctx.font = '900 36px Arial, sans-serif'
    const timeParts = formatTime(match.startsAt, timeZone).split(' ')
    const localTime = `${timeParts[0]} ${timeParts[1] ?? ''}`.trim()
    const zoneName = timeParts.slice(2).join(' ')
    ctx.fillText(localTime, 130, y + 82)
    ctx.font = '900 30px Arial, sans-serif'
    ctx.fillText(zoneName, 130, y + 116)
    ctx.fillStyle = '#effff2'
    ctx.font = '800 25px Arial, sans-serif'
    ctx.fillText(formatDate(match.startsAt, timeZone), 130, y + 148)

    ctx.fillStyle = '#071f14'
    ctx.font = '900 44px Arial, sans-serif'
    const titleBottom = wrapCanvasText(ctx, `${match.team1} vs ${match.team2}`, 374, y + 66, 760, 52)
    ctx.fillStyle = '#38664e'
    ctx.font = '700 27px Arial, sans-serif'
    wrapCanvasText(ctx, `${match.group ?? ''} - ${match.round} - ${match.ground}`, 378, Math.max(y + 132, titleBottom + 40), 820, 34)

    ctx.fillStyle = '#0fcf7b'
    ctx.font = '900 40px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(index + 1).padStart(2, '0'), width - 118, y + 76)
    ctx.textAlign = 'left'
  })

  const footerY = height - 118
  ctx.fillStyle = '#08371f'
  roundRect(ctx, 74, footerY - 46, width - 148, 112, 22)
  ctx.fill()
  ctx.fillStyle = '#f5fff4'
  ctx.font = '800 30px Arial, sans-serif'
  ctx.fillText('Save this image to Photos and zoom in for kickoff details.', 118, footerY + 4)
  ctx.fillStyle = '#9cff63'
  ctx.font = '700 24px Arial, sans-serif'
  ctx.fillText('Generated locally in your browser - matchpulse.worldcup', 118, footerY + 44)

  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement) {
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

function createNotesText(filteredMatches: Match[], selectedTeams: string[], timeZone: string, cityLabel: string) {
  const teamLine = selectedTeams.length ? selectedTeams.join(', ') : 'All confirmed group-stage teams'
  const lines = filteredMatches.map((match, index) => {
    return [
      `${index + 1}. ${match.team1} vs ${match.team2}`,
      `   ${formatLongDate(match.startsAt, timeZone)} at ${formatTime(match.startsAt, timeZone)}`,
      `   ${match.group ?? ''} - ${match.round} - ${match.ground}`,
    ].join('\n')
  })

  return [`MatchPulse - World Cup 2026 schedule`, `${cityLabel} local time - ${timeZone}`, `Teams: ${teamLine}`, '', ...lines].join('\n')
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.append(textarea)
  textarea.select()
  document.execCommand('copy')
  textarea.remove()
}

function App() {
  const guessedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'
  const guessedCity = cityOptions.find((city) => city.zone === guessedZone)?.label ?? 'Toronto'
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['Canada', 'USA', 'Argentina'])
  const [query, setQuery] = useState('')
  const [city, setCity] = useState(guessedCity)
  const [timeZone, setTimeZone] = useState(guessedZone)
  const [savedAlert, setSavedAlert] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [alertState, setAlertState] = useState<AlertState>({
    email: '',
    phone: '',
    channel: 'email',
    leadTime: '60',
  })

  const visibleTeams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const pinned = teams.filter((team) => featuredTeams.includes(team))
    const rest = teams.filter((team) => !featuredTeams.includes(team))
    const ordered = [...pinned, ...rest]
    return normalizedQuery ? ordered.filter((team) => team.toLowerCase().includes(normalizedQuery)) : ordered
  }, [query])

  const filteredMatches = useMemo(() => {
    if (selectedTeams.length === 0) return groupMatches
    return groupMatches
      .filter((match) => selectedTeams.includes(match.team1) || selectedTeams.includes(match.team2))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }, [selectedTeams])

  const selectedCityLabel = city || cityOptions.find((item) => item.zone === timeZone)?.label || 'Your city'
  const firstMatch = filteredMatches[0]
  const selectedCount = selectedTeams.length

  function toggleTeam(team: string) {
    setSelectedTeams((current) =>
      current.includes(team) ? current.filter((item) => item !== team) : [...current, team].sort((a, b) => a.localeCompare(b)),
    )
  }

  function selectCity(value: string) {
    const option = cityOptions.find((item) => item.label === value)
    setCity(value)
    if (option) setTimeZone(option.zone)
  }

  function saveAlerts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavedAlert(true)
  }

  async function handleCalendarExport() {
    const blob = createIcsBlob(filteredMatches, timeZone)
    const file = new File([blob], 'matchpulse-world-cup-schedule.ics', { type: 'text/calendar' })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'MatchPulse World Cup schedule',
        text: 'Add these World Cup matches to your calendar.',
        files: [file],
      })
      setExportMessage('Calendar file opened in your phone share sheet.')
      return
    }

    downloadBlob(blob, 'matchpulse-world-cup-schedule.ics')
    setExportMessage('Calendar file downloaded. Open it to add the matches.')
  }

  async function handleImageExport(share = false) {
    const canvas = createScheduleCanvas(filteredMatches, selectedTeams, timeZone, selectedCityLabel)
    if (!canvas) return

    const blob = await canvasToBlob(canvas)
    const file = new File([blob], 'matchpulse-readable-schedule.png', { type: 'image/png' })

    if (share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'MatchPulse schedule',
        text: 'Save this readable World Cup schedule to Photos, Files, or Notes.',
        files: [file],
      })
      setExportMessage('Image opened in your phone share sheet.')
      return
    }

    downloadBlob(blob, 'matchpulse-readable-schedule.png')
    setExportMessage('Readable image downloaded. Save it to Photos or Files.')
  }

  async function handleNotesCopy() {
    const notesText = createNotesText(filteredMatches, selectedTeams, timeZone, selectedCityLabel)
    if (navigator.share) {
      await navigator.share({
        title: 'MatchPulse World Cup schedule',
        text: notesText,
      })
      setExportMessage('Text schedule opened in your phone share sheet.')
      return
    }

    await copyToClipboard(notesText)
    setExportMessage('Plain-text schedule copied for Notes.')
  }

  return (
    <main className="app-shell">
      <div className="stadium-lights" aria-hidden="true" />
      <div className="orbital-lines" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Trophy size={22} strokeWidth={2.4} />
          </span>
          <div>
            <h1>MatchPulse</h1>
            <p>World Cup local-time watch planner</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" type="button" onClick={() => setSelectedTeams(featuredTeams)}>
            <Sparkles size={17} />
            Popular picks
          </button>
          <button className="solid-button" type="button" onClick={handleCalendarExport}>
            <Download size={17} />
            Export .ics
          </button>
          <button
            className="photo-button"
            type="button"
            onClick={() => handleImageExport(true)}
          >
            <FileImage size={17} />
            Save image
          </button>
        </div>
      </header>

      <section className="score-strip" aria-label="Schedule summary">
        <motion.div className="stat-tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <ShieldCheck size={19} />
          <span>{selectedCount || 'All'} teams tracked</span>
        </motion.div>
        <motion.div className="stat-tile" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <CalendarDays size={19} />
          <span>{filteredMatches.length} known fixtures</span>
        </motion.div>
        <motion.div className="stat-tile wide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Globe2 size={19} />
          <span>{selectedCityLabel} local time</span>
        </motion.div>
        <motion.div className="stat-tile wide" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Zap size={19} />
          <span>{firstMatch ? `${firstMatch.team1} vs ${firstMatch.team2}` : 'Pick a team'}</span>
        </motion.div>
      </section>

      <section className="workspace-grid">
        <aside className="panel team-panel">
          <div className="panel-heading">
            <div>
              <h2>Teams</h2>
              <p>Check the sides you want to follow.</p>
            </div>
            <button className="icon-button" type="button" title="Clear teams" onClick={() => setSelectedTeams([])}>
              <X size={17} />
            </button>
          </div>

          <label className="search-box">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams" />
          </label>

          <div className="team-grid">
            {visibleTeams.map((team) => {
              const selected = selectedTeams.includes(team)
              return (
                <button
                  className={`team-chip ${selected ? 'selected' : ''}`}
                  type="button"
                  key={team}
                  onClick={() => toggleTeam(team)}
                  aria-pressed={selected}
                >
                  <span className="team-crest">{team.slice(0, 2).toUpperCase()}</span>
                  <span>{team}</span>
                  {selected && <Check size={16} />}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="panel schedule-panel">
          <div className="panel-heading schedule-heading">
            <div>
              <h2>Watch Schedule</h2>
              <p>
                Kickoffs shown in <strong>{timeZone}</strong>.
              </p>
            </div>
            <div className="timezone-control">
              <MapPin size={17} />
              <input value={city} list="cities" onChange={(event) => selectCity(event.target.value)} aria-label="City" />
              <datalist id="cities">
                {cityOptions.map((option) => (
                  <option key={option.zone} value={option.label} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="schedule-list">
            <AnimatePresence mode="popLayout">
              {filteredMatches.map((match) => (
                <motion.article
                  layout
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="match-card"
                  key={`${match.date}-${match.team1}-${match.team2}`}
                >
                  <div className="kickoff">
                    <span>{formatDate(match.startsAt, timeZone)}</span>
                    <strong>{formatTime(match.startsAt, timeZone)}</strong>
                  </div>
                  <div className="match-main">
                    <div className="teams-line">
                      <span>{match.team1}</span>
                      <em>vs</em>
                      <span>{match.team2}</span>
                    </div>
                    <div className="meta-line">
                      <span>{match.group}</span>
                      <span>{match.round}</span>
                      <span>{match.ground}</span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <aside className="side-stack">
          <section className="panel alert-panel">
            <div className="panel-heading">
              <div>
                <h2>Alerts</h2>
                <p>Save a reminder preference for the selected schedule.</p>
              </div>
              <Bell size={20} />
            </div>

            <form onSubmit={saveAlerts} className="alert-form">
              <div className="segmented">
                <button
                  type="button"
                  className={alertState.channel === 'email' ? 'active' : ''}
                  onClick={() => setAlertState((current) => ({ ...current, channel: 'email' }))}
                >
                  <Mail size={16} />
                  Email
                </button>
                <button
                  type="button"
                  className={alertState.channel === 'text' ? 'active' : ''}
                  onClick={() => setAlertState((current) => ({ ...current, channel: 'text' }))}
                >
                  <MessageSquareText size={16} />
                  Text
                </button>
              </div>

              {alertState.channel === 'email' ? (
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={alertState.email}
                    onChange={(event) => setAlertState((current) => ({ ...current, email: event.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </label>
              ) : (
                <label className="field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={alertState.phone}
                    onChange={(event) => setAlertState((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+1 555 0100"
                    required
                  />
                </label>
              )}

              <label className="field">
                <span>Before kickoff</span>
                <select
                  value={alertState.leadTime}
                  onChange={(event) => setAlertState((current) => ({ ...current, leadTime: event.target.value }))}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="180">3 hours</option>
                </select>
              </label>

              <button className="solid-button full" type="submit">
                <Bell size={17} />
                Save alert setup
              </button>
            </form>

            {savedAlert && (
              <motion.p className="saved-note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                Saved locally for this prototype. A SendGrid/Twilio backend can turn this into real alerts.
              </motion.p>
            )}
          </section>

          <section className="panel export-panel">
            <div className="next-match">
              <span className="mini-label">
                <Clock3 size={15} />
                Next tracked kickoff
              </span>
              {firstMatch ? (
                <>
                  <strong>{formatLongDate(firstMatch.startsAt, timeZone)}</strong>
                  <p>
                    {formatTime(firstMatch.startsAt, timeZone)} - {firstMatch.team1} vs {firstMatch.team2}
                  </p>
                </>
              ) : (
                <p>Select a team to build your schedule.</p>
              )}
            </div>
            <button className="ghost-button full" type="button" onClick={handleCalendarExport}>
              <Download size={17} />
              Add to phone calendar
            </button>
            <button
              className="photo-button full"
              type="button"
              onClick={() => handleImageExport(true)}
            >
              <Share2 size={17} />
              Share image to Photos
            </button>
            <button className="notes-button full" type="button" onClick={handleNotesCopy}>
              <Copy size={17} />
              Copy for Notes
            </button>
            {exportMessage && <p className="export-message">{exportMessage}</p>}
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
