// Ads + affiliate monetization config and helpers.
//
// Display ads: start with Google AdSense (no traffic minimum). Set VITE_ADSENSE_CLIENT to your
// publisher id ("ca-pub-…") to activate; until then slots render a clearly labeled placeholder
// at the right size, so layout is already reserved. Migrate to Ezoic → Mediavine → Raptive (or
// Google Ad Manager direct-sold) as traffic grows — see docs/monetization-ads-affiliate.md.
//
// Affiliate "where to watch": streaming providers are monetized via affiliate networks (Impact,
// FlexOffers, CJ, Awin). Drop the affiliate URL in once you're approved; until then we link to
// the provider so the surface is built and useful.

export const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) || undefined
export const adsConfigured = Boolean(ADSENSE_CLIENT)

// Per-surface ad safety (plan rule: never run paid ads on kids/community/custom-league surfaces,
// and keep gambling/betting creatives off family surfaces entirely).
export type AdSafety = 'general' | 'family'

export function adsAllowed(safety: AdSafety): boolean {
  return safety === 'general'
}

export type AdFormat = 'leaderboard' | 'rectangle' | 'skyscraper'

// Slot sizes (CSS px) used for the reserved placeholder + the AdSense data-ad-format hint.
export const AD_FORMATS: Record<AdFormat, { w: number; h: number; label: string }> = {
  leaderboard: { w: 728, h: 90, label: 'horizontal' },
  rectangle: { w: 300, h: 250, label: 'rectangle' },
  skyscraper: { w: 160, h: 600, label: 'vertical' },
}

// Interleave an ad sentinel every `everyN` items in a list. The caller renders sentinels as
// <AdSlot/>. Keeps the schedule readable: ads punctuate long lists, never crowd short ones.
export type AdListEntry<T> =
  | { kind: 'item'; item: T; key: string }
  | { kind: 'ad'; key: string; index: number }

export function interleaveAds<T>(items: T[], keyOf: (item: T) => string, everyN = 6): Array<AdListEntry<T>> {
  const out: Array<AdListEntry<T>> = []
  let adIndex = 0
  items.forEach((item, i) => {
    out.push({ kind: 'item', item, key: keyOf(item) })
    // Insert after every Nth item, but not as the final element (no trailing ad).
    if ((i + 1) % everyN === 0 && i < items.length - 1) {
      out.push({ kind: 'ad', key: `ad-${adIndex}`, index: adIndex })
      adIndex += 1
    }
  })
  return out
}

// --- Affiliate "where to watch" -------------------------------------------------------------

export type WatchProvider = {
  key: string
  name: string
  /** Network the affiliate program runs on (where you apply). */
  network: 'Impact' | 'FlexOffers' | 'CJ' | 'Awin' | 'Direct' | 'Partnerize'
  /** Regions where the provider is relevant (ISO country codes). */
  regions: string[]
  /** Public site (fallback link). The affiliate deep-link replaces this once approved. */
  url: string
}

// Registry of monetizable streaming destinations. Affiliate ids are injected at build time via
// env (VITE_AFFILIATE_<KEY>) so we never commit partner secrets.
export const WATCH_PROVIDERS: WatchProvider[] = [
  { key: 'fubo', name: 'Fubo', network: 'Impact', regions: ['US', 'CA'], url: 'https://www.fubo.tv/' },
  { key: 'sling', name: 'Sling TV', network: 'FlexOffers', regions: ['US'], url: 'https://www.sling.com/' },
  { key: 'espn_plus', name: 'ESPN+', network: 'CJ', regions: ['US'], url: 'https://plus.espn.com/' },
  { key: 'dazn', name: 'DAZN', network: 'Awin', regions: ['US', 'CA', 'GB', 'DE', 'ES', 'IT'], url: 'https://www.dazn.com/' },
  { key: 'crave', name: 'Crave', network: 'Direct', regions: ['CA'], url: 'https://www.crave.ca/' },
  { key: 'tsn', name: 'TSN', network: 'Direct', regions: ['CA'], url: 'https://www.tsn.ca/' },
  { key: 'sportsnet', name: 'Sportsnet+', network: 'Direct', regions: ['CA'], url: 'https://www.sportsnet.ca/plus/' },
  { key: 'tnt', name: 'TNT / Max', network: 'CJ', regions: ['US'], url: 'https://www.max.com/' },
  { key: 'peacock', name: 'Peacock', network: 'Impact', regions: ['US'], url: 'https://www.peacocktv.com/' },
  { key: 'ufc', name: 'UFC Fight Pass', network: 'Direct', regions: ['US', 'CA', 'GB'], url: 'https://ufcfightpass.com/' },
]

const PROVIDER_BY_KEY = new Map(WATCH_PROVIDERS.map((p) => [p.key, p]))

// Affiliate ids per provider (set VITE_AFFILIATE_FUBO etc. when approved). Empty = link direct.
function affiliateId(key: string): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env[`VITE_AFFILIATE_${key.toUpperCase()}`]
}

export type ResolvedWatchLink = { name: string; href: string; affiliate: boolean }

// Build the outbound watch link for a provider, appending the affiliate id when present.
export function watchLinkFor(key: string): ResolvedWatchLink | null {
  const provider = PROVIDER_BY_KEY.get(key)
  if (!provider) return null
  const id = affiliateId(key)
  if (!id) return { name: provider.name, href: provider.url, affiliate: false }
  const sep = provider.url.includes('?') ? '&' : '?'
  // Generic sub-id param; each network has its own (Impact: irclickid/subId, CJ: sid, etc.).
  return { name: provider.name, href: `${provider.url}${sep}utm_source=silbo&subid=${encodeURIComponent(id)}`, affiliate: true }
}

// Fuzzy-match a broadcaster/channel string from the data feed to a known monetizable provider.
export function matchWatchProvider(channel: string): WatchProvider | null {
  const c = channel.toLowerCase()
  for (const p of WATCH_PROVIDERS) {
    if (c.includes(p.key) || c.includes(p.name.toLowerCase().split(' ')[0])) return p
  }
  return null
}
