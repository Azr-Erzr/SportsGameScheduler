import {
  CarFront,
  CircleDot,
  Disc,
  Dumbbell,
  Goal,
  LandPlot,
  Medal,
  Shield,
  Timer,
  Users,
  Volleyball,
  type LucideIcon,
} from 'lucide-react'
import type { CanonicalSportKey, SportKey } from './types'

export type SportInfo = {
  /** Stable route key shown in the sport picker. */
  key: SportKey
  /** True sport-family key for backend taxonomy. */
  canonicalSportKey: CanonicalSportKey
  /** The sport-family name, never just one league name. */
  label: string
  /** League/tournament examples shown as secondary context. */
  flagshipLeague: string
  leagueKey?: string
  icon: LucideIcon
  badgeKey: string
  enabled: boolean
  eventNoun: string
  tagline: string
  sourceNote?: string
}

export const sports: SportInfo[] = [
  {
    key: 'soccer',
    canonicalSportKey: 'soccer',
    label: 'Soccer',
    flagshipLeague: 'World Cup / UEFA / EPL / La Liga',
    leagueKey: 'wc2026',
    icon: Goal,
    badgeKey: 'soccer',
    enabled: true,
    eventNoun: 'match',
    tagline: 'World Cup 2026 is live now',
  },
  {
    key: 'basketball',
    canonicalSportKey: 'basketball',
    label: 'Basketball',
    flagshipLeague: 'NBA / WNBA / FIBA / NCAA',
    leagueKey: 'basketball',
    icon: Volleyball,
    badgeKey: 'basketball',
    enabled: false,
    eventNoun: 'game',
    tagline: 'Tip-offs, tournaments, and international windows without timezone math',
    sourceNote: 'TheSportsDB, API-SPORTS, SportsDataIO, Sportradar, and official league feeds to compare',
  },
  {
    key: 'football',
    canonicalSportKey: 'american_football',
    label: 'American Football',
    flagshipLeague: 'NFL / CFL / NCAA',
    leagueKey: 'football',
    icon: Shield,
    badgeKey: 'football',
    enabled: false,
    eventNoun: 'game',
    tagline: 'Kickoffs, bowls, playoffs, and Grey Cup context',
    sourceNote: 'NFL/CFL/NCAA coverage needs provider-rights review; TheSportsDB and enterprise feeds are candidates',
  },
  {
    key: 'hockey',
    canonicalSportKey: 'hockey',
    label: 'Hockey',
    flagshipLeague: 'NHL / PWHL / IIHF',
    leagueKey: 'nhl',
    icon: Disc,
    badgeKey: 'hockey',
    enabled: false,
    eventNoun: 'game',
    tagline: 'Every puck drop in your time',
  },
  {
    key: 'tennis',
    canonicalSportKey: 'tennis',
    label: 'Tennis',
    flagshipLeague: 'ATP / WTA / Grand Slams',
    icon: CircleDot,
    badgeKey: 'tennis',
    enabled: false,
    eventNoun: 'match',
    tagline: 'Draws, courts, players, and start-time windows',
  },
  {
    key: 'golf',
    canonicalSportKey: 'golf',
    label: 'Golf',
    flagshipLeague: 'Majors / PGA / LPGA / Ryder Cup',
    icon: LandPlot,
    badgeKey: 'golf',
    enabled: false,
    eventNoun: 'round',
    tagline: 'Tee times, pairings, cuts, and final-round windows',
  },
  {
    key: 'motorsport',
    canonicalSportKey: 'motorsport',
    label: 'Motorsport',
    flagshipLeague: 'F1 / NASCAR / IndyCar',
    leagueKey: 'f1',
    icon: CarFront,
    badgeKey: 'motorsport',
    enabled: false,
    eventNoun: 'session',
    tagline: 'Race weekends, practice, qualifying, sprints, and podiums',
    sourceNote: 'OpenF1 for F1 sessions; additional motorsport providers later',
  },
  {
    key: 'combat',
    canonicalSportKey: 'combat_sports',
    label: 'Combat Sports',
    flagshipLeague: 'UFC / PFL / Boxing',
    leagueKey: 'ufc',
    icon: Dumbbell,
    badgeKey: 'combat',
    enabled: false,
    eventNoun: 'fight card',
    tagline: 'Main cards, prelims, fighter follows, and late card changes',
    sourceNote: 'API-SPORTS MMA, SportsDataIO MMA, Sportradar MMA, and official card pages to compare',
  },
  {
    key: 'track',
    canonicalSportKey: 'athletics',
    label: 'Track & Field',
    flagshipLeague: 'World Athletics / Diamond League / Trials',
    leagueKey: 'track-field',
    icon: Timer,
    badgeKey: 'track',
    enabled: false,
    eventNoun: 'event',
    tagline: 'Meet sessions, heats, finals, start lists, and athlete follows',
    sourceNote: 'World Athletics data access and permitted providers need review',
  },
  {
    key: 'olympic',
    canonicalSportKey: 'olympic_sports',
    label: 'Olympic Sports',
    flagshipLeague: 'Olympics / Swimming / Gymnastics / Athletics',
    leagueKey: 'olympic-sports',
    icon: Medal,
    badgeKey: 'olympic',
    enabled: false,
    eventNoun: 'event',
    tagline: 'The niche-event umbrella for sports people only remember every four years',
    sourceNote: 'Official federation feeds and Olympic results/schedule licensing need sport-by-sport review',
  },
  {
    key: 'custom',
    canonicalSportKey: 'custom',
    label: 'Community',
    flagshipLeague: 'Your own leagues',
    icon: Users,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'event',
    tagline: 'Your league, your schedule',
  },
]

const routeAliases: Record<string, SportInfo> = {
  nba: sports[1],
  wnba: sports[1],
  fiba: sports[1],
  ncaa: sports[1],
  nfl: sports[2],
  cfl: sports[2],
  ncaaf: sports[2],
  nhl: sports[3],
  f1: sports[6],
  ufc: sports[7],
  pfl: sports[7],
  mma: sports[7],
}

export const customLeagueSportOptions = Array.from(
  sports
    .reduce<Map<CanonicalSportKey, { key: CanonicalSportKey; label: string }>>((options, sport) => {
      if (!options.has(sport.canonicalSportKey)) {
        options.set(sport.canonicalSportKey, {
          key: sport.canonicalSportKey,
          label: sport.canonicalSportKey === 'custom' ? 'Other' : sport.label,
        })
      }

      return options
    }, new Map())
    .values(),
)

export function getSport(key: string): SportInfo | undefined {
  return sports.find((sport) => sport.key === key) ?? routeAliases[key]
}

export function canonicalSportKeyForRoute(key: string): CanonicalSportKey | undefined {
  return getSport(key)?.canonicalSportKey
}
