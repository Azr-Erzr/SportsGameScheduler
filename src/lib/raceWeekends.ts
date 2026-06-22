// Derive race-weekend structure from flat motorsport events.
//
// The F1 provider stores each session as its own event titled "<Weekend> - <Session>", e.g.
// "Monaco Grand Prix - Practice 1", "Monaco Grand Prix - Qualifying", "Monaco Grand Prix - Race"
// (see supabase/functions/provider-hydrate-apisports-f1 titleFor). Rendered flat, a weekend looks
// like five unrelated rows. This groups them back into the weekend the user thinks in, and labels
// each session, with no provider/schema change required — a pure transform over what's already there.

export type RaceSessionKind = 'practice' | 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race' | 'session'

// Minimal shape so this stays UI- and data-source-agnostic (LiveEvent satisfies it).
export type RaceEventInput = {
  id: string
  title: string
  startsAt: Date | null
  startsAtTbd: boolean
  leagueName: string
  venue: string | null
}

export type RaceSession<E extends RaceEventInput = RaceEventInput> = {
  event: E
  kind: RaceSessionKind
  label: string
}

export type RaceWeekend<E extends RaceEventInput = RaceEventInput> = {
  key: string
  name: string
  leagueName: string
  venue: string | null
  sessions: RaceSession<E>[]
  start: Date | null
  end: Date | null
  /** The headline session (the Grand Prix itself), if present. */
  race: RaceSession<E> | null
}

const SESSION_ORDER: Record<RaceSessionKind, number> = {
  practice: 0,
  sprint_qualifying: 1,
  sprint: 2,
  qualifying: 3,
  race: 4,
  session: 5,
}

export function classifyRaceSession(label: string): RaceSessionKind {
  const l = label.toLowerCase()
  if (/sprint\s*(qual|shootout)/.test(l)) return 'sprint_qualifying'
  if (/\bsprint\b/.test(l)) return 'sprint'
  if (/qualif/.test(l)) return 'qualifying'
  if (/practice|^fp\d|\bfp\d\b|free practice|warm/.test(l)) return 'practice'
  if (/race|grand prix|\bgp\b|feature|main/.test(l)) return 'race'
  return 'session'
}

// Split "<Weekend> - <Session>" on the LAST " - " so weekend names that themselves contain a
// hyphenated word stay intact. A title with no separator is treated as the race itself.
export function parseRaceWeekendTitle(title: string): { weekend: string; label: string } {
  const idx = title.lastIndexOf(' - ')
  if (idx === -1) return { weekend: title.trim(), label: 'Race' }
  return { weekend: title.slice(0, idx).trim(), label: title.slice(idx + 3).trim() }
}

function timeOf(date: Date | null): number {
  return date ? date.getTime() : Number.POSITIVE_INFINITY
}

export function groupRaceWeekends<E extends RaceEventInput>(events: E[]): RaceWeekend<E>[] {
  const byWeekend = new Map<string, RaceWeekend<E>>()

  for (const event of events) {
    const { weekend, label } = parseRaceWeekendTitle(event.title)
    const key = `${event.leagueName}::${weekend}`.toLowerCase()
    const kind = classifyRaceSession(label)
    const session: RaceSession<E> = { event, kind, label }

    let group = byWeekend.get(key)
    if (!group) {
      group = {
        key,
        name: weekend,
        leagueName: event.leagueName,
        venue: event.venue,
        sessions: [],
        start: null,
        end: null,
        race: null,
      }
      byWeekend.set(key, group)
    }
    group.sessions.push(session)
    if (!group.venue && event.venue) group.venue = event.venue
  }

  const weekends = [...byWeekend.values()]
  for (const group of weekends) {
    group.sessions.sort((a, b) => {
      const ta = timeOf(a.event.startsAt)
      const tb = timeOf(b.event.startsAt)
      if (ta !== tb) return ta - tb
      return SESSION_ORDER[a.kind] - SESSION_ORDER[b.kind]
    })
    const dated = group.sessions.map((s) => s.event.startsAt).filter((d): d is Date => Boolean(d))
    group.start = dated.length ? dated[0] : null
    group.end = dated.length ? dated[dated.length - 1] : null
    group.race = group.sessions.find((s) => s.kind === 'race') ?? null
  }

  // Weekends in chronological order; undated weekends sink to the bottom.
  return weekends.sort((a, b) => timeOf(a.start) - timeOf(b.start))
}

export const RACE_SESSION_LABELS: Record<RaceSessionKind, string> = {
  practice: 'Practice',
  qualifying: 'Qualifying',
  sprint_qualifying: 'Sprint Qualifying',
  sprint: 'Sprint',
  race: 'Race',
  session: 'Session',
}
