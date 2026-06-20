// Forward-looking generic event model shared across sports.
// The prototype still renders World Cup `Match` objects (see ./match.ts); this is the target
// shape that provider sync, calendar feeds, and the multi-sport UI normalize toward. Keeping
// it here makes `src/domain` the single source of truth for the data model.

export type CanonicalSportKey =
  | 'soccer'
  | 'motorsport'
  | 'hockey'
  | 'basketball'
  | 'tennis'
  | 'golf'
  | 'mma'
  | 'combat_sports'
  | 'american_football'
  | 'athletics'
  | 'olympic_sports'
  | 'baseball'
  | 'custom'

export type SportKey =
  | 'soccer'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'motorsport'
  | 'combat'
  | 'track'
  | 'olympic'
  | 'f1'
  | 'nhl'
  | 'nba'
  | 'wnba'
  | 'tennis'
  | 'golf'
  | 'ufc'
  | 'cfl'
  | 'baseball'
  | 'mlb'
  | 'custom'

export type EventStatus =
  | 'scheduled'
  | 'time_tbd'
  | 'postponed'
  | 'cancelled'
  | 'live'
  | 'finished'

export type EventKind =
  | 'match'
  | 'game'
  | 'race'
  | 'practice'
  | 'qualifying'
  | 'sprint'
  | 'round'
  | 'tee_time'
  | 'custom_event'

export type CompetitorRole =
  | 'home'
  | 'away'
  | 'driver'
  | 'player'
  | 'field'
  | 'participant'

export type EventCompetitor = {
  competitorId: string
  role: CompetitorRole
  position?: number | null
}

export type Broadcast = {
  country: string
  channel: string
  streamUrl?: string | null
}

export type ScheduleEvent = {
  id: string
  sportKey: CanonicalSportKey
  leagueId: string | null
  seasonId: string | null
  providerId: string | null
  providerEventId: string | null
  kind: EventKind
  status: EventStatus
  startsAt: string | null
  startsAtTbd: boolean
  timezone: string | null
  venueId: string | null
  // Source of truth for participation (works for n-ary sports, not just 1v1).
  competitors: EventCompetitor[]
  // Optional 1v1 convenience denormalization only.
  homeCompetitorId: string | null
  awayCompetitorId: string | null
  broadcasts?: Broadcast[]
  visibility: 'public' | 'private'
  version: number
  title: string
  shortTitle: string
  metadata: Record<string, unknown>
}
