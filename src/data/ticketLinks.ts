export type TicketOption = {
  key: string
  name: string
  href: string
  affiliate: boolean
  note: string
  priority: number
}

type TicketProvider = {
  key: string
  name: string
  regions: string[]
  urlFor: (query: string, region: string) => string
  note: string
  priority: number
}

type TicketQuery = {
  title: string
  leagueName?: string | null
  venue?: string | null
  regionCode?: string | null
  eventId?: string | null
  placement?: string | null
  /** Use an official event URL when the source data already provides one. */
  ticketmasterUrl?: string | null
  limit?: number
}

function encoded(query: string) {
  return encodeURIComponent(query)
}

const TICKETMASTER_DOMAINS: Record<string, string> = {
  AE: 'ticketmaster.ae',
  AT: 'ticketmaster.at',
  AU: 'ticketmaster.com.au',
  BE: 'ticketmaster.be',
  BR: 'ticketmaster.com.br',
  CA: 'ticketmaster.ca',
  CH: 'ticketmaster.ch',
  CL: 'ticketmaster.cl',
  CZ: 'ticketmaster.cz',
  DE: 'ticketmaster.de',
  DK: 'ticketmaster.dk',
  ES: 'ticketmaster.es',
  FI: 'ticketmaster.fi',
  FR: 'ticketmaster.fr',
  GB: 'ticketmaster.co.uk',
  GR: 'ticketmaster.gr',
  IE: 'ticketmaster.ie',
  IT: 'ticketmaster.it',
  MX: 'ticketmaster.com.mx',
  NL: 'ticketmaster.nl',
  NO: 'ticketmaster.no',
  NZ: 'ticketmaster.co.nz',
  PE: 'ticketmaster.pe',
  PL: 'ticketmaster.pl',
  SE: 'ticketmaster.se',
  TR: 'ticketmaster.com.tr',
  US: 'ticketmaster.com',
  ZA: 'ticketmaster.co.za',
}

const TICKETMASTER_REGIONS = Object.keys(TICKETMASTER_DOMAINS)

function ticketmasterSearchUrl(query: string, region: string) {
  const domain = TICKETMASTER_DOMAINS[region] ?? TICKETMASTER_DOMAINS.US
  const searchKey = region === 'GB' ? 'keyword' : 'q'
  return `https://www.${domain}/search?${searchKey}=${encoded(query)}`
}

function validTicketmasterDestination(value: string | null | undefined, region: string) {
  if (!value) return null
  try {
    const destination = new URL(value)
    const domain = TICKETMASTER_DOMAINS[region]
    if (destination.protocol !== 'https:' || !domain) return null
    if (destination.hostname !== domain && destination.hostname !== `www.${domain}`) return null
    return destination.toString()
  } catch (_) {
    return null
  }
}

function trackingValue(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return normalized || fallback
}

export function buildImpactTicketDeepLink(
  trackingUrl: string,
  destinationUrl: string,
  options: { placement?: string | null; eventId?: string | null } = {},
) {
  try {
    const tracking = new URL(trackingUrl)
    const destination = new URL(destinationUrl)
    if (tracking.protocol !== 'https:' || destination.protocol !== 'https:') return trackingUrl
    // Impact's full links use /c/{partner}/{ad}/{campaign}. Leave vanity or other network links
    // untouched because their deep-link syntax may differ.
    if (!/^\/c\/[^/]+\/[^/]+\/[^/]+/.test(tracking.pathname)) return trackingUrl
    tracking.searchParams.set('u', destination.toString())
    tracking.searchParams.set('subId1', trackingValue(options.placement, 'web-event'))
    if (options.eventId) tracking.searchParams.set('subId2', trackingValue(options.eventId, 'event'))
    return tracking.toString()
  } catch (_) {
    return trackingUrl
  }
}

const TICKET_PROVIDERS: TicketProvider[] = [
  {
    key: 'ticketmaster',
    name: 'Ticketmaster',
    regions: TICKETMASTER_REGIONS,
    urlFor: ticketmasterSearchUrl,
    note: 'Primary/verified resale where available',
    priority: 1,
  },
  {
    key: 'stubhub',
    name: 'StubHub',
    regions: ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'NL', 'MX'],
    urlFor: (query) => `https://www.stubhub.com/find/s/?q=${encoded(query)}`,
    note: 'Marketplace listings',
    priority: 2,
  },
  {
    key: 'seatgeek',
    name: 'SeatGeek',
    regions: ['US', 'CA'],
    urlFor: (query) => `https://seatgeek.com/search?q=${encoded(query)}`,
    note: 'Marketplace listings',
    priority: 3,
  },
  {
    key: 'vivid_seats',
    name: 'Vivid Seats',
    regions: ['US', 'CA'],
    urlFor: (query) => `https://www.vividseats.com/search?searchTerm=${encoded(query)}`,
    note: 'Marketplace listings',
    priority: 4,
  },
]

function affiliateHref(key: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env[`VITE_TICKET_AFFILIATE_${key.toUpperCase()}`]
}

function ticketmasterAffiliateHref(region: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  const contractRegion = region === 'GB' ? 'UK' : region
  const regional = env[`VITE_TICKET_AFFILIATE_TICKETMASTER_${contractRegion}`]
  // The unqualified Ticketmaster contract is the North American fallback. Never send another
  // territory through it: Impact campaign IDs and allowed landing domains are program-specific.
  if (regional) return regional
  if (region === 'US' || region === 'CA') return env.VITE_TICKET_AFFILIATE_TICKETMASTER
  return undefined
}

function buildQuery({ title, leagueName, venue }: TicketQuery) {
  return [title, leagueName, venue].filter(Boolean).join(' ')
}

export function ticketOptionsFor(query: TicketQuery): TicketOption[] {
  const region = (query.regionCode ?? 'US').toUpperCase()
  const search = buildQuery(query).trim()
  if (!search) return []

  return TICKET_PROVIDERS
    .filter((provider) => provider.regions.includes(region) || provider.regions.includes('US'))
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .slice(0, query.limit ?? 4)
    .map((provider) => {
      const destination =
        provider.key === 'ticketmaster'
          ? validTicketmasterDestination(query.ticketmasterUrl, region) ?? provider.urlFor(search, region)
          : provider.urlFor(search, region)
      const affiliate = provider.key === 'ticketmaster' ? ticketmasterAffiliateHref(region) : affiliateHref(provider.key)
      const affiliateActive = Boolean(affiliate && /^https:\/\//i.test(affiliate))
      const href =
        affiliateActive && affiliate
          ? provider.key === 'ticketmaster'
            ? buildImpactTicketDeepLink(affiliate, destination, {
                placement: query.placement,
                eventId: query.eventId,
              })
            : affiliate
          : destination
      return {
        key: provider.key,
        name: provider.name,
        href,
        affiliate: affiliateActive,
        note: provider.note,
        priority: provider.priority,
      }
    })
}
