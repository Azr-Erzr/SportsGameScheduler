// World Cup 2026 dataset access. Bundled openfootball JSON stays the demo/fallback source
// (provider strategy, Objective 4); this module is the only place that knows its shape.

import worldCup from './worldcup2026.json'
import type { Match, RawMatch } from '../domain/match'
import { parseKickoff } from '../lib/time'

// Placeholder codes like "1A", "W49", "3C/3D" mean the slot is not a confirmed team yet.
const placeholderPattern = /^(?:\d[A-L]|W\d+|L\d+|\d[A-L]\/|3[A-L])/

export function isKnownTeam(team: string) {
  return !placeholderPattern.test(team)
}

export const allMatches: Match[] = (worldCup.matches as RawMatch[]).map((match) => ({
  ...match,
  startsAt: parseKickoff(match.date, match.time),
}))

export const groupMatches = allMatches.filter((match) => isKnownTeam(match.team1) && isKnownTeam(match.team2))

export const teams = Array.from(new Set(groupMatches.flatMap((match) => [match.team1, match.team2]))).sort(
  (a, b) => a.localeCompare(b),
)

export const featuredTeams = ['Canada', 'USA', 'Mexico', 'Argentina', 'Brazil', 'England', 'France', 'Portugal']

export function matchesForTeams(selected: string[]): Match[] {
  if (selected.length === 0) return groupMatches
  return groupMatches
    .filter((match) => selected.includes(match.team1) || selected.includes(match.team2))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
