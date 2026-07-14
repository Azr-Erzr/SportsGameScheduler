export type TicketEmailLink = {
  name: string
  url: string
  affiliate: true
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

function trackingValue(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return normalized || fallback
}

function searchUrl(query: string, region: string) {
  const domain = TICKETMASTER_DOMAINS[region] ?? TICKETMASTER_DOMAINS.US
  const searchKey = region === 'GB' ? 'keyword' : 'q'
  return `https://www.${domain}/search?${searchKey}=${encodeURIComponent(query)}`
}

function validDestination(value: string | null | undefined, region: string) {
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

export function ticketmasterContractEnvKey(region: string) {
  return `TICKETMASTER_AFFILIATE_${region === 'GB' ? 'UK' : region}`
}

export function buildTicketmasterEmailLink(options: {
  trackingUrl: string | null | undefined
  region: string
  title: string
  leagueName?: string | null
  venue?: string | null
  eventId?: string | null
  ticketmasterUrl?: string | null
  placement?: string | null
}): TicketEmailLink | null {
  if (!options.trackingUrl) return null
  const region = options.region.toUpperCase()
  if (!TICKETMASTER_DOMAINS[region]) return null
  const query = [options.title, options.leagueName, options.venue].filter(Boolean).join(' ').trim()
  const destination = validDestination(options.ticketmasterUrl, region) ?? searchUrl(query, region)

  try {
    const tracking = new URL(options.trackingUrl)
    if (tracking.protocol !== 'https:' || !/^\/c\/[^/]+\/[^/]+\/[^/]+/.test(tracking.pathname)) return null
    tracking.searchParams.set('u', destination)
    tracking.searchParams.set('subId1', trackingValue(options.placement, 'email-alert'))
    if (options.eventId) tracking.searchParams.set('subId2', trackingValue(options.eventId, 'event'))
    return { name: 'Ticketmaster', url: tracking.toString(), affiliate: true }
  } catch (_) {
    return null
  }
}

export function ticketUrlFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null
  for (const key of ['ticketmaster_url', 'ticket_url', 'tickets_url']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}
