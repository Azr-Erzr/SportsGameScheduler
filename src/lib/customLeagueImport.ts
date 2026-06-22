import type { CustomEvent } from './store'

type ParseOptions = {
  makeId: () => string
}

type ParsedCsv = {
  events: CustomEvent[]
  errors: string[]
}

const HEADER_ALIASES: Record<string, string> = {
  event: 'title',
  game: 'title',
  match: 'title',
  location: 'venue',
  place: 'venue',
  opponentname: 'opponent',
  arrive: 'arriveEarlyMinutes',
  arriveearly: 'arriveEarlyMinutes',
  arriveearlyminutes: 'arriveEarlyMinutes',
  uniform: 'uniformColor',
  kit: 'uniformColor',
  start: 'startsAt',
  startsat: 'startsAt',
  datetime: 'startsAt',
}

function normalizeHeader(value: string) {
  const key = value.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return HEADER_ALIASES[key] ?? key
}

function splitCsvLine(line: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine)
}

function normalizeStatus(value: string | undefined): CustomEvent['status'] {
  const status = value?.trim().toLowerCase()
  if (status === 'cancelled' || status === 'canceled') return 'cancelled'
  if (status === 'postponed') return 'postponed'
  return 'scheduled'
}

function parseStart(row: Record<string, string>) {
  const explicit = row.startsAt?.trim()
  const date = row.date?.trim()
  const time = row.time?.trim() || '12:00'
  const value = explicit || (date ? `${date}T${time.length === 5 ? `${time}:00` : time}` : '')
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseCustomLeagueEventsCsv(text: string, options: ParseOptions): ParsedCsv {
  const rows = parseCsv(text)
  if (rows.length < 2) return { events: [], errors: ['CSV needs a header row and at least one event row.'] }

  const headers = rows[0].map(normalizeHeader)
  const events: CustomEvent[] = []
  const errors: string[] = []

  rows.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
    const title = row.title?.trim()
    const starts = parseStart(row)

    if (!title) {
      errors.push(`Row ${rowNumber}: missing title.`)
      return
    }
    if (!starts) {
      errors.push(`Row ${rowNumber}: missing or invalid date/time.`)
      return
    }

    const arriveEarlyMinutes = row.arriveEarlyMinutes ? Number(row.arriveEarlyMinutes) : undefined
    events.push({
      id: options.makeId(),
      title,
      startsAt: starts.toISOString(),
      venue: row.venue?.trim() ?? '',
      opponent: row.opponent?.trim() || undefined,
      arriveEarlyMinutes: Number.isFinite(arriveEarlyMinutes) ? arriveEarlyMinutes : undefined,
      uniformColor: row.uniformColor?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
      status: normalizeStatus(row.status),
    })
  })

  return { events, errors }
}
