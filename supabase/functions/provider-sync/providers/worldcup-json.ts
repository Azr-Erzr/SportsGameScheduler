// Demo/fallback adapter: the bundled openfootball World Cup 2026 dataset (public domain).
// Proves the adapter contract end-to-end before any licensed provider is wired in.

import type { ProviderEvent, SportsProviderAdapter } from './types.ts'

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

const DATASET_URL = Deno.env.get('WORLDCUP_JSON_URL') ?? ''

function parseKickoff(date: string, time: string): string | undefined {
  const match = time.match(/^(\d{1,2}):(\d{2}) UTC([+-]\d{1,2})(?::(\d{2}))?$/)
  if (!match) return undefined
  const [, rawHour, rawMinute, rawOffsetHour, rawOffsetMinute] = match
  const [year, month, day] = date.split('-').map(Number)
  const sign = rawOffsetHour.startsWith('-') ? -1 : 1
  const offsetMinutes = sign * (Math.abs(Number(rawOffsetHour)) * 60 + (rawOffsetMinute ? Number(rawOffsetMinute) : 0))
  return new Date(
    Date.UTC(year, month - 1, day, Number(rawHour), Number(rawMinute)) - offsetMinutes * 60_000,
  ).toISOString()
}

export const worldCupJsonAdapter: SportsProviderAdapter = {
  key: 'worldcup_json',

  async listEvents({ from, to }) {
    if (!DATASET_URL) throw new Error('WORLDCUP_JSON_URL is not configured')
    const response = await fetch(DATASET_URL)
    if (!response.ok) throw new Error(`Dataset fetch failed: ${response.status}`)
    const data = (await response.json()) as { matches: RawMatch[] }

    return data.matches
      .map((match, index): ProviderEvent | null => {
        const startsAt = parseKickoff(match.date, match.time)
        if (startsAt && (startsAt < from || startsAt > to)) return null
        return {
          providerKey: 'worldcup_json',
          // Array index, not match.num: num is missing on some knockout rows and collides.
          providerEventId: `wc2026-${index}`,
          sportKey: 'soccer',
          leagueExternalId: 'wc2026',
          kind: 'match',
          status: 'scheduled',
          title: `${match.team1} vs ${match.team2}`,
          shortTitle: `${match.team1} v ${match.team2}`,
          startsAt,
          startsAtTbd: !startsAt,
          venue: { name: match.ground },
          competitors: [
            { role: 'home', name: match.team1, providerCompetitorId: match.team1 },
            { role: 'away', name: match.team2, providerCompetitorId: match.team2 },
          ],
          metadata: { round: match.round, group: match.group ?? null },
          raw: match,
        }
      })
      .filter((event): event is ProviderEvent => event !== null)
  },
}
