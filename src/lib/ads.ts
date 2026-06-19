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
  network: 'Impact' | 'FlexOffers' | 'CJ' | 'Awin' | 'Direct' | 'Partnerize' | 'Cuelinks'
  /** Approval state for the programme, if any. */
  affiliateStatus?: 'none' | 'pending' | 'approved' | 'paused' | 'rejected'
  /** Regions where the provider is relevant (ISO country codes). */
  regions: string[]
  /** Sport keys where the provider is commonly relevant. Empty means broadly useful. */
  sports?: string[]
  /** Public site (fallback link). The affiliate deep-link replaces this once approved. */
  url: string
}

// Registry of monetizable streaming destinations. Affiliate ids are injected at build time via
// env (VITE_AFFILIATE_<KEY>) so we never commit partner secrets.
export const WATCH_PROVIDERS: WatchProvider[] = [
  { key: 'dazn', name: 'DAZN', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'DE', 'ES', 'IT', 'ZA'], sports: ['soccer', 'combat', 'boxing', 'mma'], url: 'https://www.dazn.com/' },
  { key: 'paramount_plus', name: 'Paramount+', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU'], sports: ['soccer', 'combat', 'football'], url: 'https://www.paramountplus.com/' },
  { key: 'ufc_fight_pass', name: 'UFC Fight Pass', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU', 'IN'], sports: ['combat', 'mma'], url: 'https://ufcfightpass.com/' },
  { key: 'prime_video', name: 'Prime Video', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'ES', 'IN', 'ZA'], sports: ['combat', 'boxing', 'soccer', 'football', 'basketball'], url: 'https://www.primevideo.com/' },
  { key: 'ppv_com', name: 'PPV.com', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA'], sports: ['combat', 'boxing', 'mma'], url: 'https://www.ppv.com/' },
  { key: 'espn_plus', name: 'ESPN+', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'combat', 'football', 'basketball', 'hockey', 'tennis', 'golf'], url: 'https://plus.espn.com/' },
  { key: 'fubo', name: 'Fubo', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US', 'CA'], sports: ['soccer', 'football', 'basketball', 'hockey', 'baseball'], url: 'https://www.fubo.tv/' },
  { key: 'sling', name: 'Sling TV', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'football', 'basketball', 'hockey', 'baseball', 'combat'], url: 'https://www.sling.com/' },
  { key: 'peacock', name: 'Peacock', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'football', 'olympic', 'track'], url: 'https://www.peacocktv.com/' },
  { key: 'max_tnt', name: 'TNT Sports / Max', network: 'CJ', affiliateStatus: 'pending', regions: ['US'], sports: ['basketball', 'hockey', 'soccer', 'combat'], url: 'https://www.max.com/' },
  { key: 'tsn', name: 'TSN', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['soccer', 'football', 'basketball', 'hockey', 'combat', 'tennis', 'golf'], url: 'https://www.tsn.ca/' },
  { key: 'sportsnet_plus', name: 'Sportsnet+', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['hockey', 'baseball', 'basketball', 'soccer', 'combat'], url: 'https://www.sportsnet.ca/plus/' },
  { key: 'crave', name: 'Crave', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['soccer', 'combat', 'basketball', 'hockey'], url: 'https://www.crave.ca/' },
  { key: 'cbc_gem', name: 'CBC Gem', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['olympic', 'soccer', 'hockey', 'track'], url: 'https://gem.cbc.ca/' },
  { key: 'sky_sports', name: 'Sky Sports', network: 'Direct', affiliateStatus: 'pending', regions: ['GB', 'IE'], sports: ['soccer', 'football', 'f1', 'motorsport', 'boxing', 'combat', 'golf', 'tennis'], url: 'https://www.skysports.com/' },
  { key: 'now_sports', name: 'NOW Sports', network: 'Direct', affiliateStatus: 'pending', regions: ['GB', 'IE'], sports: ['soccer', 'football', 'f1', 'motorsport', 'boxing', 'combat', 'golf', 'tennis'], url: 'https://www.nowtv.com/sports' },
  { key: 'tnt_sports_uk', name: 'TNT Sports UK', network: 'Direct', affiliateStatus: 'pending', regions: ['GB', 'IE'], sports: ['soccer', 'combat', 'boxing', 'mma'], url: 'https://www.tntsports.co.uk/' },
  { key: 'bbc_iplayer', name: 'BBC iPlayer', network: 'Direct', affiliateStatus: 'none', regions: ['GB'], sports: ['soccer', 'olympic', 'tennis', 'track'], url: 'https://www.bbc.co.uk/iplayer' },
  { key: 'itvx', name: 'ITVX', network: 'Direct', affiliateStatus: 'none', regions: ['GB'], sports: ['soccer', 'rugby', 'boxing'], url: 'https://www.itv.com/' },
  { key: 'movistar_plus', name: 'Movistar Plus+', network: 'Direct', affiliateStatus: 'pending', regions: ['ES'], sports: ['soccer', 'f1', 'motorsport', 'basketball', 'tennis', 'golf'], url: 'https://www.movistarplus.es/' },
  { key: 'rtve', name: 'RTVE Play', network: 'Direct', affiliateStatus: 'none', regions: ['ES'], sports: ['soccer', 'olympic', 'tennis', 'track'], url: 'https://www.rtve.es/play/' },
  { key: 'showmax', name: 'Showmax', network: 'Direct', affiliateStatus: 'pending', regions: ['ZA', 'NG', 'KE', 'GH'], sports: ['soccer', 'football', 'rugby', 'combat'], url: 'https://www.showmax.com/' },
  { key: 'dstv_supersport', name: 'DStv / SuperSport', network: 'Direct', affiliateStatus: 'pending', regions: ['ZA', 'NG', 'KE', 'GH'], sports: ['soccer', 'rugby', 'cricket', 'combat', 'motorsport', 'tennis', 'golf'], url: 'https://www.dstv.com/' },
  { key: 'bein_sports', name: 'beIN SPORTS', network: 'Direct', affiliateStatus: 'pending', regions: ['QA', 'SA', 'AE', 'EG', 'MA', 'FR', 'ES', 'US'], sports: ['soccer', 'tennis', 'motorsport', 'combat'], url: 'https://www.beinsports.com/' },
  { key: 'sonyliv', name: 'SonyLIV', network: 'Cuelinks', affiliateStatus: 'pending', regions: ['IN'], sports: ['soccer', 'cricket', 'combat', 'tennis'], url: 'https://www.sonyliv.com/' },
  { key: 'fancode', name: 'FanCode', network: 'Direct', affiliateStatus: 'pending', regions: ['IN'], sports: ['cricket', 'soccer', 'basketball', 'baseball'], url: 'https://www.fancode.com/' },
  { key: 'hotstar_jio', name: 'JioHotstar', network: 'Direct', affiliateStatus: 'pending', regions: ['IN'], sports: ['cricket', 'football', 'soccer', 'tennis', 'olympic'], url: 'https://www.hotstar.com/in' },
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
  if (/^https?:\/\//i.test(id)) return { name: provider.name, href: id, affiliate: true }
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
