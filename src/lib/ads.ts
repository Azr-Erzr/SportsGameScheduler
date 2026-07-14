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
  { key: 'fox_sports', name: 'FOX Sports', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['world_cup'], url: 'https://www.foxsports.com/soccer/fifa-world-cup' },
  { key: 'telemundo', name: 'Telemundo Deportes', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['world_cup'], url: 'https://www.telemundo.com/deportes' },
  { key: 'ctv_tsn_rds', name: 'CTV / TSN / RDS', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['world_cup'], url: 'https://www.tsn.ca/soccer' },
  { key: 'rte_player', name: 'RTE Player', network: 'Direct', affiliateStatus: 'none', regions: ['IE'], sports: ['world_cup', 'soccer'], url: 'https://www.rte.ie/player/' },
  { key: 'm6', name: 'M6+', network: 'Direct', affiliateStatus: 'none', regions: ['FR'], sports: ['world_cup', 'soccer'], url: 'https://www.m6.fr/' },
  { key: 'ard', name: 'ARD Mediathek', network: 'Direct', affiliateStatus: 'none', regions: ['DE'], sports: ['world_cup'], url: 'https://www.ardmediathek.de/' },
  { key: 'zdf', name: 'ZDF', network: 'Direct', affiliateStatus: 'none', regions: ['DE'], sports: ['world_cup', 'soccer'], url: 'https://www.zdf.de/' },
  { key: 'magenta_sport', name: 'MagentaSport', network: 'Direct', affiliateStatus: 'none', regions: ['DE'], sports: ['world_cup', 'soccer'], url: 'https://www.magentasport.de/' },
  { key: 'rai_play', name: 'RaiPlay', network: 'Direct', affiliateStatus: 'none', regions: ['IT'], sports: ['world_cup', 'soccer'], url: 'https://www.raiplay.it/' },
  { key: 'dazn_it', name: 'DAZN Italy', network: 'Direct', affiliateStatus: 'pending', regions: ['IT'], sports: ['world_cup', 'soccer'], url: 'https://www.dazn.com/it-IT/home' },
  { key: 'dazn_es', name: 'DAZN Spain', network: 'Direct', affiliateStatus: 'pending', regions: ['ES'], sports: ['world_cup', 'soccer', 'f1', 'motorsport'], url: 'https://www.dazn.com/es-ES/home' },
  { key: 'nos', name: 'NOS', network: 'Direct', affiliateStatus: 'none', regions: ['NL'], sports: ['world_cup', 'soccer'], url: 'https://nos.nl/sport' },
  { key: 'vrt_max', name: 'VRT MAX', network: 'Direct', affiliateStatus: 'none', regions: ['BE'], sports: ['world_cup', 'soccer'], url: 'https://www.vrt.be/vrtmax/' },
  { key: 'rtbf_auvio', name: 'RTBF Auvio', network: 'Direct', affiliateStatus: 'none', regions: ['BE'], sports: ['world_cup', 'soccer'], url: 'https://auvio.rtbf.be/' },
  { key: 'sport_tv_pt', name: 'Sport TV', network: 'Direct', affiliateStatus: 'none', regions: ['PT'], sports: ['world_cup', 'soccer'], url: 'https://www.sporttv.pt/' },
  { key: 'tvi', name: 'TVI', network: 'Direct', affiliateStatus: 'none', regions: ['PT'], sports: ['world_cup', 'soccer'], url: 'https://tvi.iol.pt/' },
  { key: 'rtp_play', name: 'RTP Play', network: 'Direct', affiliateStatus: 'none', regions: ['PT'], sports: ['world_cup', 'soccer'], url: 'https://www.rtp.pt/play/' },
  { key: 'dr_tv', name: 'DR TV', network: 'Direct', affiliateStatus: 'none', regions: ['DK'], sports: ['world_cup', 'soccer'], url: 'https://www.dr.dk/drtv/' },
  { key: 'tv2_dk', name: 'TV 2 Denmark', network: 'Direct', affiliateStatus: 'none', regions: ['DK'], sports: ['world_cup', 'soccer'], url: 'https://tv2.dk/' },
  { key: 'svt_play', name: 'SVT Play', network: 'Direct', affiliateStatus: 'none', regions: ['SE'], sports: ['world_cup', 'soccer'], url: 'https://www.svtplay.se/' },
  { key: 'tv4_play', name: 'TV4 Play', network: 'Direct', affiliateStatus: 'none', regions: ['SE'], sports: ['world_cup', 'soccer'], url: 'https://www.tv4play.se/' },
  { key: 'tv2_play_no', name: 'TV 2 Play Norway', network: 'Direct', affiliateStatus: 'none', regions: ['NO'], sports: ['world_cup', 'soccer'], url: 'https://play.tv2.no/' },
  { key: 'nrk_tv', name: 'NRK TV', network: 'Direct', affiliateStatus: 'none', regions: ['NO'], sports: ['world_cup', 'soccer'], url: 'https://tv.nrk.no/' },
  { key: 'yle_areena', name: 'Yle Areena', network: 'Direct', affiliateStatus: 'none', regions: ['FI'], sports: ['world_cup', 'soccer'], url: 'https://areena.yle.fi/' },
  { key: 'mtv_katsomo', name: 'MTV Katsomo', network: 'Direct', affiliateStatus: 'none', regions: ['FI'], sports: ['world_cup', 'soccer'], url: 'https://www.mtv.fi/' },
  { key: 'orf_on', name: 'ORF ON', network: 'Direct', affiliateStatus: 'none', regions: ['AT'], sports: ['world_cup', 'soccer'], url: 'https://on.orf.at/' },
  { key: 'servus_tv', name: 'ServusTV', network: 'Direct', affiliateStatus: 'none', regions: ['AT'], sports: ['world_cup', 'soccer'], url: 'https://www.servustv.com/' },
  { key: 'srg_ssr', name: 'SRG SSR', network: 'Direct', affiliateStatus: 'none', regions: ['CH'], sports: ['world_cup', 'soccer'], url: 'https://www.srgssr.ch/' },
  { key: 'tvp_sport', name: 'TVP Sport', network: 'Direct', affiliateStatus: 'none', regions: ['PL'], sports: ['world_cup', 'soccer'], url: 'https://sport.tvp.pl/' },
  { key: 'canal_plus', name: 'CANAL+', network: 'Direct', affiliateStatus: 'pending', regions: ['FR', 'PL', 'LU', 'CH'], sports: ['soccer', 'rugby', 'motorsport', 'tennis'], url: 'https://www.canalplus.com/' },
  { key: 'televisa', name: 'Televisa', network: 'Direct', affiliateStatus: 'none', regions: ['MX'], sports: ['world_cup', 'soccer'], url: 'https://www.tudn.com/' },
  { key: 'tv_azteca', name: 'TV Azteca Deportes', network: 'Direct', affiliateStatus: 'none', regions: ['MX'], sports: ['world_cup', 'soccer'], url: 'https://www.tvazteca.com/aztecadeportes/' },
  { key: 'globo', name: 'Globo', network: 'Direct', affiliateStatus: 'none', regions: ['BR'], sports: ['world_cup', 'soccer'], url: 'https://ge.globo.com/' },
  { key: 'cazetv', name: 'CazeTV', network: 'Direct', affiliateStatus: 'none', regions: ['BR'], sports: ['world_cup', 'soccer'], url: 'https://www.youtube.com/@CazeTV' },
  { key: 'telefe', name: 'Telefe', network: 'Direct', affiliateStatus: 'none', regions: ['AR'], sports: ['world_cup', 'soccer'], url: 'https://mitelefe.com/' },
  { key: 'tyc_sports', name: 'TyC Sports', network: 'Direct', affiliateStatus: 'none', regions: ['AR'], sports: ['world_cup', 'soccer'], url: 'https://www.tycsports.com/' },
  { key: 'sbs_on_demand', name: 'SBS On Demand', network: 'Direct', affiliateStatus: 'none', regions: ['AU'], sports: ['world_cup', 'soccer'], url: 'https://www.sbs.com.au/ondemand/' },
  { key: 'tvnz', name: 'TVNZ+', network: 'Direct', affiliateStatus: 'none', regions: ['NZ'], sports: ['world_cup', 'soccer'], url: 'https://www.tvnz.co.nz/' },
  { key: 'apple_mls', name: 'MLS on Apple TV', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU'], sports: ['soccer', 'mls'], url: 'https://tv.apple.com/us/channel/mls/tvs.sbd.7000' },
  { key: 'nfl_game_pass_dazn', name: 'NFL Game Pass on DAZN', network: 'Direct', affiliateStatus: 'pending', regions: ['CA', 'GB', 'DE', 'FR', 'IT', 'ES'], sports: ['football', 'nfl', 'american_football'], url: 'https://www.dazn.com/en-GB/l/nfl-game-pass' },
  { key: 'nhl_tv_dazn', name: 'NHL.TV on DAZN', network: 'Direct', affiliateStatus: 'pending', regions: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE'], sports: ['hockey'], url: 'https://www.dazn.com/' },
  { key: 'icc_tv', name: 'ICC.tv', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['cricket'], url: 'https://www.icc.tv/' },
  { key: 'willow_tv', name: 'Willow TV', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA'], sports: ['cricket'], url: 'https://www.willow.tv/' },
  { key: 'wtt_live', name: 'World Table Tennis', network: 'Direct', affiliateStatus: 'none', regions: ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES'], sports: ['table_tennis'], url: 'https://www.worldtabletennis.com/livevideo' },
  { key: 'dazn', name: 'DAZN', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'DE', 'ES', 'IT', 'ZA'], sports: ['soccer', 'combat', 'boxing', 'mma'], url: 'https://www.dazn.com/' },
  { key: 'paramount_plus', name: 'Paramount+', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU'], sports: ['soccer', 'combat', 'football'], url: 'https://www.paramountplus.com/' },
  { key: 'ufc_fight_pass', name: 'UFC Fight Pass', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU', 'IN'], sports: ['combat', 'mma'], url: 'https://ufcfightpass.com/' },
  { key: 'prime_video', name: 'Prime Video', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'ES', 'IN', 'ZA'], sports: ['combat', 'boxing', 'soccer', 'football', 'basketball'], url: 'https://www.primevideo.com/' },
  { key: 'ppv_com', name: 'PPV.com', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA'], sports: ['combat', 'boxing', 'mma'], url: 'https://www.ppv.com/' },
  { key: 'espn_plus', name: 'ESPN+', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'combat', 'football', 'basketball', 'hockey', 'tennis', 'golf'], url: 'https://plus.espn.com/' },
  { key: 'cbs_sports', name: 'CBS Sports', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['basketball', 'football', 'golf'], url: 'https://www.cbssports.com/' },
  { key: 'ion', name: 'ION', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['basketball', 'hockey'], url: 'https://iontelevision.com/sports' },
  { key: 'usa_network', name: 'USA Network', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['basketball', 'olympic'], url: 'https://www.usanetwork.com/' },
  { key: 'fubo', name: 'Fubo', network: 'FlexOffers', affiliateStatus: 'rejected', regions: ['US', 'CA'], sports: ['soccer', 'football', 'basketball', 'hockey', 'baseball'], url: 'https://www.fubo.tv/' },
  { key: 'mlb_tv', name: 'MLB.TV', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU', 'JP'], sports: ['baseball'], url: 'https://www.mlb.com/live-stream-games' },
  { key: 'nba_league_pass', name: 'NBA League Pass', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU', 'IN'], sports: ['basketball'], url: 'https://www.nba.com/watch/league-pass-stream' },
  { key: 'wnba_league_pass', name: 'WNBA League Pass', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU'], sports: ['basketball', 'wnba'], url: 'https://www.wnba.com/leaguepass' },
  { key: 'formula1_tv', name: 'F1 TV', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU', 'IN', 'ZA', 'ES'], sports: ['motorsport', 'f1'], url: 'https://f1tv.formula1.com/' },
  { key: 'apple_tv', name: 'Apple TV', network: 'Direct', affiliateStatus: 'pending', regions: ['US', 'CA', 'GB', 'AU'], sports: ['soccer', 'baseball'], url: 'https://tv.apple.com/' },
  { key: 'sling', name: 'Sling TV', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'football', 'basketball', 'hockey', 'baseball', 'combat'], url: 'https://www.sling.com/' },
  { key: 'peacock', name: 'Peacock', network: 'FlexOffers', affiliateStatus: 'pending', regions: ['US'], sports: ['soccer', 'football', 'olympic', 'track'], url: 'https://www.peacocktv.com/' },
  { key: 'max_tnt', name: 'TNT Sports / Max', network: 'CJ', affiliateStatus: 'pending', regions: ['US'], sports: ['basketball', 'hockey', 'soccer', 'combat'], url: 'https://www.max.com/' },
  { key: 'tsn', name: 'TSN', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['soccer', 'football', 'basketball', 'hockey', 'combat', 'tennis', 'golf'], url: 'https://www.tsn.ca/' },
  { key: 'sportsnet_plus', name: 'Sportsnet+', network: 'Direct', affiliateStatus: 'none', regions: ['CA'], sports: ['hockey', 'baseball', 'basketball', 'soccer', 'combat', 'golf'], url: 'https://www.sportsnet.ca/plus/' },
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
  // League-rights providers referenced by the per-league CATALOG_RULES (docs/where-to-watch-rights-truth.md).
  // All start as unpaid direct links; swap to affiliate via VITE_AFFILIATE_<KEY> when approved.
  { key: 'nbc_sports', name: 'NBC Sports', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['soccer', 'football'], url: 'https://www.nbcsports.com/soccer/premier-league' },
  { key: 'premier_sports', name: 'Premier Sports', network: 'Direct', affiliateStatus: 'none', regions: ['GB', 'IE'], sports: ['soccer'], url: 'https://www.premiersports.com/' },
  { key: 'viaplay', name: 'Viaplay', network: 'Direct', affiliateStatus: 'none', regions: ['NL', 'SE', 'NO', 'DK', 'FI', 'GB', 'PL'], sports: ['soccer', 'football', 'f1', 'motorsport'], url: 'https://viaplay.com/' },
  { key: 'sky_de', name: 'Sky Deutschland', network: 'Direct', affiliateStatus: 'none', regions: ['DE', 'AT'], sports: ['soccer', 'f1', 'motorsport'], url: 'https://www.sky.de/sport' },
  { key: 'sky_it', name: 'Sky Italia', network: 'Direct', affiliateStatus: 'none', regions: ['IT'], sports: ['soccer', 'f1', 'motorsport'], url: 'https://www.sky.it/sport' },
  { key: 'ziggo_sport', name: 'Ziggo Sport', network: 'Direct', affiliateStatus: 'none', regions: ['NL'], sports: ['soccer', 'f1', 'motorsport'], url: 'https://www.ziggosport.nl/' },
  { key: 'channel4', name: 'Channel 4', network: 'Direct', affiliateStatus: 'none', regions: ['GB'], sports: ['motorsport', 'f1'], url: 'https://www.channel4.com/now/C4' },
  { key: 'tudn', name: 'TUDN', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['soccer'], url: 'https://www.tudn.com/' },
  { key: 'wimbledon_tv', name: 'Wimbledon Watch', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['tennis'], url: 'https://www.wimbledon.com/en_GB/about/tv_coverage' },
  { key: 'tennis_tv', name: 'Tennis TV', network: 'Direct', affiliateStatus: 'pending', regions: [], sports: ['tennis'], url: 'https://www.tennistv.com/' },
  { key: 'golf_channel', name: 'Golf Channel', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['golf'], url: 'https://www.golfchannel.com/watch/on-air-schedule' },
  { key: 'pga_tour', name: 'PGA TOUR', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['golf'], url: 'https://www.pgatour.com/watch' },
  { key: 'cfl_plus', name: 'CFL+', network: 'Direct', affiliateStatus: 'none', regions: ['US', 'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'MX', 'AU'], sports: ['american_football', 'football', 'cfl'], url: 'https://www.cfl.ca/plus/' },
  { key: 'rugbypass_tv', name: 'RugbyPass TV', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['rugby'], url: 'https://rugbypass.tv/' },
  { key: 'pwhl_site', name: 'thePWHL.com', network: 'Direct', affiliateStatus: 'none', regions: ['US', 'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'AU', 'NZ'], sports: ['hockey', 'pwhl'], url: 'https://www.thepwhl.com/en/where-to-watch' },
  { key: 'pwhl_youtube', name: 'PWHL YouTube', network: 'Direct', affiliateStatus: 'none', regions: ['US', 'GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'AU', 'NZ'], sports: ['hockey', 'pwhl'], url: 'https://www.youtube.com/@thepwhlofficial' },
  { key: 'vbtv', name: 'VBTV', network: 'Direct', affiliateStatus: 'pending', regions: [], sports: ['volleyball'], url: 'https://tv.volleyballworld.com/' },
  { key: 'wst_play', name: 'WST Play', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['snooker'], url: 'https://www.wst.tv/watch-live/' },
  { key: 'pdc_tv', name: 'PDC TV', network: 'Direct', affiliateStatus: 'pending', regions: [], sports: ['darts'], url: 'https://video.pdc.tv/' },
  { key: 'world_athletics_watch', name: 'World Athletics Watch', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['athletics', 'track'], url: 'https://worldathletics.org/watch/live' },
  { key: 'nbc_olympics', name: 'NBC Olympics', network: 'Direct', affiliateStatus: 'none', regions: ['US'], sports: ['olympic', 'olympic_sports', 'track'], url: 'https://www.nbcolympics.com/' },
  { key: 'discovery_plus', name: 'Discovery+ / Eurosport', network: 'Direct', affiliateStatus: 'pending', regions: ['GB', 'IE', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI', 'PL'], sports: ['olympic', 'olympic_sports', 'cycling', 'tennis', 'snooker'], url: 'https://www.discoveryplus.com/' },
  { key: 'olympics_com', name: 'Olympics.com', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['olympic', 'olympic_sports'], url: 'https://olympics.com/' },
  { key: 'lolesports', name: 'LoL Esports', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['esports'], url: 'https://lolesports.com/' },
  { key: 'valorant_twitch', name: 'VALORANT Twitch', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['esports'], url: 'https://www.twitch.tv/valorant' },
  { key: 'blastpremier_twitch', name: 'BLAST Premier Twitch', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['esports'], url: 'https://www.twitch.tv/blastpremier' },
  { key: 'eslcs_twitch', name: 'ESL CS Twitch', network: 'Direct', affiliateStatus: 'none', regions: [], sports: ['esports'], url: 'https://www.twitch.tv/eslcs' },
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
