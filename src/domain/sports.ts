import {
  IconBallAmericanFootball,
  IconBallBaseball,
  IconBallBasketball,
  IconBallFootball,
  IconBallTennis,
  IconBallVolleyball,
  IconBike,
  IconCategory,
  IconCircle,
  IconCricket,
  IconDeviceGamepad2,
  IconDisc,
  IconGolf,
  IconHelmet,
  IconKarate,
  IconOlympicTorch,
  IconPlayHandball,
  IconRugby,
  IconRun,
  IconTarget,
  type Icon,
} from '@tabler/icons-react'
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
  icon: Icon
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
    icon: IconBallFootball,
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
    icon: IconBallBasketball,
    badgeKey: 'basketball',
    enabled: true,
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
    icon: IconBallAmericanFootball,
    badgeKey: 'football',
    enabled: true,
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
    icon: IconDisc,
    badgeKey: 'hockey',
    enabled: true,
    eventNoun: 'game',
    tagline: 'Every puck drop in your time',
  },
  {
    key: 'tennis',
    canonicalSportKey: 'tennis',
    label: 'Tennis',
    flagshipLeague: 'ATP / WTA / Grand Slams',
    icon: IconBallTennis,
    badgeKey: 'tennis',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Draws, courts, players, and start-time windows',
  },
  {
    key: 'golf',
    canonicalSportKey: 'golf',
    label: 'Golf',
    flagshipLeague: 'Majors / PGA / LPGA / Ryder Cup',
    icon: IconGolf,
    badgeKey: 'golf',
    enabled: true,
    eventNoun: 'round',
    tagline: 'Tee times, pairings, cuts, and final-round windows',
  },
  {
    key: 'motorsport',
    canonicalSportKey: 'motorsport',
    label: 'Motorsport',
    flagshipLeague: 'F1 / NASCAR / IndyCar',
    leagueKey: 'f1',
    icon: IconHelmet,
    badgeKey: 'motorsport',
    enabled: true,
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
    icon: IconKarate,
    badgeKey: 'combat',
    enabled: true,
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
    icon: IconRun,
    badgeKey: 'track',
    enabled: true,
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
    icon: IconOlympicTorch,
    badgeKey: 'olympic',
    enabled: true,
    eventNoun: 'event',
    tagline: 'The niche-event umbrella for sports people only remember every four years',
    sourceNote: 'Official federation feeds and Olympic results/schedule licensing need sport-by-sport review',
  },
  {
    key: 'baseball',
    canonicalSportKey: 'baseball',
    label: 'Baseball',
    flagshipLeague: 'MLB / NPB / KBO / NCAA',
    leagueKey: 'mlb',
    icon: IconBallBaseball,
    badgeKey: 'baseball',
    enabled: true,
    eventNoun: 'game',
    tagline: 'First pitches, doubleheaders, and postseason — every start time in your zone',
    sourceNote: 'TheSportsDB, API-SPORTS, SportsDataIO, Sportradar, and official league feeds to compare',
  },
  {
    key: 'custom',
    canonicalSportKey: 'custom',
    label: 'Other Sports',
    flagshipLeague: 'Badminton · Cricket · Rugby · more',
    icon: IconCategory,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'event',
    tagline: 'Badminton, cricket, rugby, squash, table tennis and everything else people play',
  },
]

export const secondarySports: SportInfo[] = [
  {
    key: 'cricket',
    canonicalSportKey: 'cricket',
    label: 'Cricket',
    flagshipLeague: 'IPL / Big Bash / World Cups',
    leagueKey: 'cricket',
    icon: IconCricket,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Tests, ODIs, T20 leagues, and tournament windows',
    sourceNote: 'TheSportsDB has cricket league coverage; Sportmonks and SportsAPI360 remain provider candidates',
  },
  {
    key: 'rugby',
    canonicalSportKey: 'rugby',
    label: 'Rugby',
    flagshipLeague: 'Six Nations / Rugby World Cup / Super Rugby',
    leagueKey: 'rugby',
    icon: IconRugby,
    badgeKey: 'football',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Union, league, Sevens, tours, and World Cup paths',
    sourceNote: 'TheSportsDB has rugby league/tournament coverage; rights vary by competition',
  },
  {
    key: 'volleyball',
    canonicalSportKey: 'volleyball',
    label: 'Volleyball',
    flagshipLeague: 'FIVB / CEV / domestic leagues',
    leagueKey: 'volleyball',
    icon: IconBallVolleyball,
    badgeKey: 'basketball',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Indoor, beach, Nations League, championships, and club cups',
  },
  {
    key: 'handball',
    canonicalSportKey: 'handball',
    label: 'Handball',
    flagshipLeague: 'Bundesliga / EHF / Worlds',
    leagueKey: 'handball',
    icon: IconPlayHandball,
    badgeKey: 'basketball',
    enabled: true,
    eventNoun: 'match',
    tagline: 'European leagues, EHF nights, and international championships',
  },
  {
    key: 'cycling',
    canonicalSportKey: 'cycling',
    label: 'Cycling',
    flagshipLeague: 'UCI World Tour / ProSeries',
    leagueKey: 'cycling',
    icon: IconBike,
    badgeKey: 'motorsport',
    enabled: true,
    eventNoun: 'race',
    tagline: 'Tours, classics, stages, and championship calendars',
  },
  {
    key: 'snooker',
    canonicalSportKey: 'snooker',
    label: 'Snooker',
    flagshipLeague: 'World Snooker Tour',
    leagueKey: 'snooker',
    icon: IconCircle,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Ranking events, finals sessions, and long-format matches',
  },
  {
    key: 'darts',
    canonicalSportKey: 'darts',
    label: 'Darts',
    flagshipLeague: 'PDC / World Championship',
    leagueKey: 'darts',
    icon: IconTarget,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'match',
    tagline: 'PDC nights, majors, and world championship sessions',
  },
  {
    key: 'esports',
    canonicalSportKey: 'esports',
    label: 'Esports',
    flagshipLeague: 'LoL / Dota 2 / CS / COD / R6',
    leagueKey: 'esports',
    icon: IconDeviceGamepad2,
    badgeKey: 'custom',
    enabled: true,
    eventNoun: 'match',
    tagline: 'Majors, splits, and international LANs across the biggest titles',
    sourceNote: 'PandaScore provides schedules for League, Dota 2, CS, Call of Duty, and Rainbow Six',
  },
]

export const sportRoutes = [...sports, ...secondarySports]

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
  mlb: sports[10],
}

export const customLeagueSportOptions = Array.from(
  sportRoutes
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
  return sportRoutes.find((sport) => sport.key === key) ?? routeAliases[key]
}

export function canonicalSportKeyForRoute(key: string): CanonicalSportKey | undefined {
  return getSport(key)?.canonicalSportKey
}

// The "other sports" category. Secondary sports share uniform Other Sports art and iconography
// (no dedicated banners/icons yet) until one earns promotion to a main tile. Centralised here so a
// new secondary sport is automatically treated uniformly everywhere — banner, icon, ordering.
export const secondarySportKeys = new Set<string>(secondarySports.map((sport) => sport.key))

export function isSecondarySport(key: string): boolean {
  const sport = getSport(key)
  return Boolean((sport && secondarySportKeys.has(sport.key)) || secondarySportKeys.has(key))
}

// Pluralise an event noun for stat labels ("match" → "matches", "race" → "races", "game" → "games").
export function pluralizeEventNoun(noun: string): string {
  return /(?:ch|sh|s|x|z)$/i.test(noun) ? `${noun}es` : `${noun}s`
}
