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
  limit?: number
}

function encoded(query: string) {
  return encodeURIComponent(query)
}

function ticketmasterUrl(query: string, region: string) {
  if (region === 'CA') return `https://www.ticketmaster.ca/search?q=${encoded(query)}`
  if (region === 'GB' || region === 'IE') return `https://www.ticketmaster.co.uk/search?keyword=${encoded(query)}`
  return `https://www.ticketmaster.com/search?q=${encoded(query)}`
}

const TICKET_PROVIDERS: TicketProvider[] = [
  {
    key: 'ticketmaster',
    name: 'Ticketmaster',
    regions: ['US', 'CA', 'GB', 'IE'],
    urlFor: ticketmasterUrl,
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
      const affiliate = affiliateHref(provider.key)
      return {
        key: provider.key,
        name: provider.name,
        href: affiliate && /^https?:\/\//i.test(affiliate) ? affiliate : provider.urlFor(search, region),
        affiliate: Boolean(affiliate),
        note: provider.note,
        priority: provider.priority,
      }
    })
}
