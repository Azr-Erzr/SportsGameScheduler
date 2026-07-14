import type { SportInfo } from '../domain/sports'
import type { CanonicalSportKey } from '../domain/types'

export type SportTicketSearch = {
  title: string
  searchTitle: string
  body: string
}

const SPORT_TICKET_SEARCHES: Partial<Record<CanonicalSportKey, SportTicketSearch>> = {
  american_football: {
    title: 'NFL tickets',
    searchTitle: 'NFL',
    body: 'Season tickets, single-game listings, and resale inventory can appear before every matchup is loaded into the schedule.',
  },
  baseball: {
    title: 'Baseball tickets',
    searchTitle: 'MLB',
    body: 'Browse primary and resale listings for upcoming baseball dates, including regular-season games and playoff runs.',
  },
  basketball: {
    title: 'Basketball tickets',
    searchTitle: 'NBA',
    body: 'Look ahead for NBA, WNBA, and major basketball listings while the fixture list continues to refresh.',
  },
  combat_sports: {
    title: 'Fight tickets',
    searchTitle: 'UFC',
    body: 'Find live cards, arena events, and combat-sports ticket inventory before the full bout order is final.',
  },
  hockey: {
    title: 'Hockey tickets',
    searchTitle: 'NHL',
    body: 'Preseason, regular-season, and playoff listings can open before every puck drop is visible in the schedule.',
  },
  motorsport: {
    title: 'Motorsport tickets',
    searchTitle: 'Formula 1',
    body: 'Search race-weekend inventory for grand prix, qualifying, and motorsport sessions in supported markets.',
  },
  soccer: {
    title: 'Soccer tickets',
    searchTitle: 'Soccer',
    body: 'Search match listings across club and international soccer while exact fixture availability continues to update.',
  },
  tennis: {
    title: 'Tennis tickets',
    searchTitle: 'Tennis',
    body: 'Find tournament sessions, day passes, and court inventory while draws and start times keep moving.',
  },
}

export function ticketSearchForSport(sport: Pick<SportInfo, 'canonicalSportKey' | 'label' | 'eventNoun'>): SportTicketSearch {
  return (
    SPORT_TICKET_SEARCHES[sport.canonicalSportKey] ?? {
      title: `${sport.label} tickets`,
      searchTitle: sport.label,
      body: `Search primary and resale ticket marketplaces for upcoming ${sport.label.toLowerCase()} ${sport.eventNoun}s when inventory is available.`,
    }
  )
}
