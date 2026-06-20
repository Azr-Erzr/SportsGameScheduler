export type IcsFeedEvent = {
  uid: string
  sequence: number
  summary: string
  description: string | null
  location: string | null
  startsAt: string | null
  endsAt: string | null
  allDay: boolean
  timezone: string | null
  status: 'scheduled' | 'cancelled' | 'tentative'
  url: string | null
  raw: Record<string, unknown>
}

export type IcsFeedParseResult = {
  title: string | null
  events: IcsFeedEvent[]
}

type ContentLine = {
  name: string
  params: Record<string, string>
  value: string
}

function unfold(input: string) {
  return input.replace(/\r?\n[ \t]/g, '')
}

function parseLine(line: string): ContentLine | null {
  const colon = line.indexOf(':')
  if (colon < 0) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [rawName, ...rawParams] = head.split(';')
  if (!rawName) return null
  const params: Record<string, string> = {}
  for (const rawParam of rawParams) {
    const eq = rawParam.indexOf('=')
    if (eq < 0) continue
    params[rawParam.slice(0, eq).toUpperCase()] = rawParam.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: rawName.toUpperCase(), params, value }
}

function unescapeText(value: string) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim()
}

function toIsoDate(value: string, params: Record<string, string>): { iso: string | null; allDay: boolean; timezone: string | null } {
  const timezone = params.TZID ?? null
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4))
    const m = Number(value.slice(4, 6))
    const d = Number(value.slice(6, 8))
    if (!y || !m || !d) return { iso: null, allDay: true, timezone }
    return { iso: new Date(Date.UTC(y, m - 1, d)).toISOString(), allDay: true, timezone }
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!match) return { iso: null, allDay: false, timezone }
  const [, year, month, day, hour, minute, second, z] = match
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)),
  )
  if (Number.isNaN(date.getTime())) return { iso: null, allDay: false, timezone }

  // Floating/TZID times need source-specific review before they become official truth. The
  // MVP normalizer preserves TZID in metadata and stores a deterministic UTC instant.
  return { iso: date.toISOString(), allDay: false, timezone: z ? 'UTC' : timezone }
}

function normalizeStatus(value: string | undefined): IcsFeedEvent['status'] {
  const status = (value ?? '').toUpperCase()
  if (status === 'CANCELLED') return 'cancelled'
  if (status === 'TENTATIVE') return 'tentative'
  return 'scheduled'
}

function componentBlocks(lines: string[], componentName: string) {
  const blocks: string[][] = []
  let current: string[] | null = null
  for (const line of lines) {
    if (line.toUpperCase() === `BEGIN:${componentName}`) {
      current = []
      continue
    }
    if (line.toUpperCase() === `END:${componentName}`) {
      if (current) blocks.push(current)
      current = null
      continue
    }
    if (current) current.push(line)
  }
  return blocks
}

export function parseIcsFeed(input: string): IcsFeedParseResult {
  const lines = unfold(input)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)

  const calendarTitle =
    lines.map(parseLine).find((line) => line?.name === 'X-WR-CALNAME' || line?.name === 'NAME')?.value ?? null

  const events = componentBlocks(lines, 'VEVENT').flatMap((block) => {
    const props = new Map<string, ContentLine[]>()
    for (const raw of block) {
      const line = parseLine(raw)
      if (!line) continue
      const list = props.get(line.name) ?? []
      list.push(line)
      props.set(line.name, list)
    }

    const uid = unescapeText(props.get('UID')?.[0]?.value ?? '')
    const summary = unescapeText(props.get('SUMMARY')?.[0]?.value ?? '')
    const starts = props.get('DTSTART')?.[0]
    if (!uid || !summary || !starts) return []

    const start = toIsoDate(starts.value, starts.params)
    const endLine = props.get('DTEND')?.[0]
    const end = endLine ? toIsoDate(endLine.value, endLine.params) : { iso: null, allDay: start.allDay, timezone: start.timezone }

    return [
      {
        uid,
        sequence: Number(props.get('SEQUENCE')?.[0]?.value ?? 0) || 0,
        summary,
        description: props.get('DESCRIPTION')?.[0] ? unescapeText(props.get('DESCRIPTION')![0].value) : null,
        location: props.get('LOCATION')?.[0] ? unescapeText(props.get('LOCATION')![0].value) : null,
        startsAt: start.iso,
        endsAt: end.iso,
        allDay: start.allDay,
        timezone: start.timezone,
        status: normalizeStatus(props.get('STATUS')?.[0]?.value),
        url: props.get('URL')?.[0]?.value ?? null,
        raw: Object.fromEntries([...props.entries()].map(([key, value]) => [key, value.map((line) => line.value)])),
      },
    ]
  })

  return { title: calendarTitle ? unescapeText(calendarTitle) : null, events }
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashIcsEvent(event: IcsFeedEvent): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      uid: event.uid,
      sequence: event.sequence,
      summary: event.summary,
      description: event.description,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      timezone: event.timezone,
      status: event.status,
      url: event.url,
    }),
  )
}

export function externalIcsId(targetKey: string, uid: string) {
  return `${targetKey}:${uid}`.slice(0, 500)
}
