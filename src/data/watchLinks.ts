import { useEffect, useState } from 'react'
import { WATCH_PROVIDERS, watchLinkFor } from '../lib/ads'
import { getSupabaseClient } from '../lib/supabase'

export type WatchOption = {
  key: string
  name: string
  href: string
  affiliate: boolean
  network?: string
  source: 'db' | 'catalog' | 'fallback'
  priority: number
}

type ProviderRow = {
  key: string
  name: string
  network: string
  affiliate_status: 'none' | 'pending' | 'approved' | 'paused' | 'rejected'
  direct_url: string
  affiliate_url: string | null
  priority: number
}

type WatchLinkRow = {
  provider_key: string
  label: string | null
  event_id: string | null
  league_id: string | null
  country_codes: string[]
  sport_keys: string[]
  link_kind: 'official' | 'affiliate' | 'sponsored' | 'free'
  url: string | null
  affiliate_url: string | null
  priority: number
  watch_providers: ProviderRow | null
}

type WatchQuery = {
  eventId?: string | null
  leagueId?: string | null
  leagueName?: string | null
  sportKey?: string | null
  regionCode?: string | null
  limit?: number
}

type CatalogRule = {
  ruleKey: string
  providerKey: string
  label: string
  countryCodes: string[]
  sportKeys: string[]
  leagueNamePattern?: RegExp
  priority: number
}

const WORLD_CUP_2026 = /(?:fifa\s+)?world cup(?:\s+2026)?/i

const CATALOG_RULES: CatalogRule[] = [
  { ruleKey: 'wc2026_us_fox', providerKey: 'fox_sports', label: 'FOX Sports', countryCodes: ['US'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_us_telemundo', providerKey: 'telemundo', label: 'Telemundo Deportes', countryCodes: ['US'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_ca_bell', providerKey: 'ctv_tsn_rds', label: 'CTV / TSN / RDS', countryCodes: ['CA'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_gb_bbc', providerKey: 'bbc_iplayer', label: 'BBC iPlayer', countryCodes: ['GB'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_gb_itv', providerKey: 'itvx', label: 'ITVX', countryCodes: ['GB'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_ie_rte', providerKey: 'rte_player', label: 'RTE Player', countryCodes: ['IE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_fr_m6', providerKey: 'm6', label: 'M6+', countryCodes: ['FR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_fr_bein', providerKey: 'bein_sports', label: 'beIN SPORTS', countryCodes: ['FR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_de_ard', providerKey: 'ard', label: 'ARD Mediathek', countryCodes: ['DE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_de_zdf', providerKey: 'zdf', label: 'ZDF', countryCodes: ['DE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_de_magenta', providerKey: 'magenta_sport', label: 'MagentaSport', countryCodes: ['DE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 3 },
  { ruleKey: 'wc2026_it_rai', providerKey: 'rai_play', label: 'RaiPlay', countryCodes: ['IT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_it_dazn', providerKey: 'dazn_it', label: 'DAZN Italy', countryCodes: ['IT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_es_rtve', providerKey: 'rtve', label: 'RTVE Play', countryCodes: ['ES'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_es_dazn', providerKey: 'dazn_es', label: 'DAZN Spain', countryCodes: ['ES'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_nl_nos', providerKey: 'nos', label: 'NOS', countryCodes: ['NL'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_be_vrt', providerKey: 'vrt_max', label: 'VRT MAX', countryCodes: ['BE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_be_rtbf', providerKey: 'rtbf_auvio', label: 'RTBF Auvio', countryCodes: ['BE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_pt_sporttv', providerKey: 'sport_tv_pt', label: 'Sport TV', countryCodes: ['PT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_pt_tvi', providerKey: 'tvi', label: 'TVI', countryCodes: ['PT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_pt_rtp', providerKey: 'rtp_play', label: 'RTP Play', countryCodes: ['PT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 3 },
  { ruleKey: 'wc2026_dk_dr', providerKey: 'dr_tv', label: 'DR TV', countryCodes: ['DK'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_dk_tv2', providerKey: 'tv2_dk', label: 'TV 2 Denmark', countryCodes: ['DK'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_se_svt', providerKey: 'svt_play', label: 'SVT Play', countryCodes: ['SE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_se_tv4', providerKey: 'tv4_play', label: 'TV4 Play', countryCodes: ['SE'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_no_tv2', providerKey: 'tv2_play_no', label: 'TV 2 Play Norway', countryCodes: ['NO'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_no_nrk', providerKey: 'nrk_tv', label: 'NRK TV', countryCodes: ['NO'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_fi_yle', providerKey: 'yle_areena', label: 'Yle Areena', countryCodes: ['FI'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_fi_mtv', providerKey: 'mtv_katsomo', label: 'MTV Katsomo', countryCodes: ['FI'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_at_orf', providerKey: 'orf_on', label: 'ORF ON', countryCodes: ['AT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_at_servus', providerKey: 'servus_tv', label: 'ServusTV', countryCodes: ['AT'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_ch_srg', providerKey: 'srg_ssr', label: 'SRG SSR', countryCodes: ['CH'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_pl_tvp', providerKey: 'tvp_sport', label: 'TVP Sport', countryCodes: ['PL'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_mx_televisa', providerKey: 'televisa', label: 'Televisa / TUDN', countryCodes: ['MX'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_mx_azteca', providerKey: 'tv_azteca', label: 'TV Azteca Deportes', countryCodes: ['MX'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_br_globo', providerKey: 'globo', label: 'Globo / ge', countryCodes: ['BR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_br_cazetv', providerKey: 'cazetv', label: 'CazeTV', countryCodes: ['BR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_ar_telefe', providerKey: 'telefe', label: 'Telefe', countryCodes: ['AR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_ar_tyc', providerKey: 'tyc_sports', label: 'TyC Sports', countryCodes: ['AR'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 2 },
  { ruleKey: 'wc2026_au_sbs', providerKey: 'sbs_on_demand', label: 'SBS On Demand', countryCodes: ['AU'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'wc2026_nz_tvnz', providerKey: 'tvnz', label: 'TVNZ+', countryCodes: ['NZ'], sportKeys: ['soccer', 'world_cup'], leagueNamePattern: WORLD_CUP_2026, priority: 1 },
  { ruleKey: 'soccer_mls_global_apple', providerKey: 'apple_mls', label: 'MLS on Apple TV', countryCodes: ['US', 'CA', 'GB', 'AU'], sportKeys: ['soccer', 'mls'], leagueNamePattern: /\bmls\b|major league soccer/i, priority: 15 },
  { ruleKey: 'football_international_nfl_game_pass_dazn', providerKey: 'nfl_game_pass_dazn', label: 'NFL Game Pass on DAZN', countryCodes: ['CA', 'GB', 'DE', 'FR', 'IT', 'ES'], sportKeys: ['american_football', 'football', 'nfl'], leagueNamePattern: /\bnfl\b|national football league/i, priority: 18 },
  { ruleKey: 'hockey_international_nhl_tv_dazn', providerKey: 'nhl_tv_dazn', label: 'NHL.TV on DAZN', countryCodes: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE'], sportKeys: ['hockey'], leagueNamePattern: /\bnhl\b|national hockey league/i, priority: 18 },
  { ruleKey: 'cricket_us_ca_willow', providerKey: 'willow_tv', label: 'Willow TV', countryCodes: ['US', 'CA'], sportKeys: ['cricket'], priority: 10 },
  { ruleKey: 'table_tennis_wtt_live', providerKey: 'wtt_live', label: 'World Table Tennis', countryCodes: ['US', 'CA', 'GB', 'DE', 'FR', 'IT', 'ES'], sportKeys: ['table_tennis'], priority: 30 },

  // --- Soccer leagues (docs/where-to-watch-rights-truth.md "Soccer Leagues And Competitions").
  // Official rights holders per market; matched on league name so no DB league_id is required.
  // English Premier League
  { ruleKey: 'epl_us_nbc', providerKey: 'nbc_sports', label: 'NBC Sports', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_us_peacock', providerKey: 'peacock', label: 'Peacock', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 2 },
  { ruleKey: 'epl_us_fubo', providerKey: 'fubo', label: 'Fubo', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 3 },
  { ruleKey: 'epl_ca_fubo', providerKey: 'fubo', label: 'Fubo', countryCodes: ['CA'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_gb_sky', providerKey: 'sky_sports', label: 'Sky Sports', countryCodes: ['GB', 'IE'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_gb_tnt', providerKey: 'tnt_sports_uk', label: 'TNT Sports', countryCodes: ['GB', 'IE'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 2 },
  { ruleKey: 'epl_gb_bbc', providerKey: 'bbc_iplayer', label: 'BBC (highlights)', countryCodes: ['GB'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 3 },
  { ruleKey: 'epl_fr_canal', providerKey: 'canal_plus', label: 'CANAL+', countryCodes: ['FR'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_de_sky', providerKey: 'sky_de', label: 'Sky Deutschland', countryCodes: ['DE', 'AT'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_it_sky', providerKey: 'sky_it', label: 'Sky Italia', countryCodes: ['IT'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_es_dazn', providerKey: 'dazn_es', label: 'DAZN', countryCodes: ['ES'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  { ruleKey: 'epl_nl_viaplay', providerKey: 'viaplay', label: 'Viaplay', countryCodes: ['NL'], sportKeys: ['soccer'], leagueNamePattern: /premier league/i, priority: 1 },
  // UEFA Champions League
  { ruleKey: 'ucl_us_paramount', providerKey: 'paramount_plus', label: 'Paramount+', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_us_tudn', providerKey: 'tudn', label: 'TUDN', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 2 },
  { ruleKey: 'ucl_ca_dazn', providerKey: 'dazn', label: 'DAZN', countryCodes: ['CA'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_gb_tnt', providerKey: 'tnt_sports_uk', label: 'TNT Sports', countryCodes: ['GB', 'IE'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_fr_canal', providerKey: 'canal_plus', label: 'CANAL+', countryCodes: ['FR'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_de_dazn', providerKey: 'dazn', label: 'DAZN', countryCodes: ['DE', 'AT'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_it_sky', providerKey: 'sky_it', label: 'Sky Italia', countryCodes: ['IT'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_it_prime', providerKey: 'prime_video', label: 'Prime Video', countryCodes: ['IT'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 2 },
  { ruleKey: 'ucl_es_movistar', providerKey: 'movistar_plus', label: 'Movistar Plus+', countryCodes: ['ES'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  { ruleKey: 'ucl_nl_ziggo', providerKey: 'ziggo_sport', label: 'Ziggo Sport', countryCodes: ['NL'], sportKeys: ['soccer'], leagueNamePattern: /champions league/i, priority: 1 },
  // LaLiga
  { ruleKey: 'laliga_us_espn', providerKey: 'espn_plus', label: 'ESPN+', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /la\s?liga/i, priority: 1 },
  { ruleKey: 'laliga_gb_premier', providerKey: 'premier_sports', label: 'Premier Sports', countryCodes: ['GB', 'IE'], sportKeys: ['soccer'], leagueNamePattern: /la\s?liga/i, priority: 1 },
  { ruleKey: 'laliga_es_movistar', providerKey: 'movistar_plus', label: 'Movistar Plus+', countryCodes: ['ES'], sportKeys: ['soccer'], leagueNamePattern: /la\s?liga/i, priority: 1 },
  // Bundesliga
  { ruleKey: 'bundesliga_us_espn', providerKey: 'espn_plus', label: 'ESPN+', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /bundesliga/i, priority: 1 },
  { ruleKey: 'bundesliga_de_sky', providerKey: 'sky_de', label: 'Sky Deutschland', countryCodes: ['DE', 'AT'], sportKeys: ['soccer'], leagueNamePattern: /bundesliga/i, priority: 1 },
  // Serie A
  { ruleKey: 'seriea_us_paramount', providerKey: 'paramount_plus', label: 'Paramount+', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /serie a/i, priority: 1 },
  { ruleKey: 'seriea_ca_fubo', providerKey: 'fubo', label: 'Fubo', countryCodes: ['CA'], sportKeys: ['soccer'], leagueNamePattern: /serie a/i, priority: 1 },
  { ruleKey: 'seriea_gb_dazn', providerKey: 'dazn', label: 'DAZN', countryCodes: ['GB', 'IE'], sportKeys: ['soccer'], leagueNamePattern: /serie a/i, priority: 1 },
  { ruleKey: 'seriea_it_dazn', providerKey: 'dazn_it', label: 'DAZN', countryCodes: ['IT'], sportKeys: ['soccer'], leagueNamePattern: /serie a/i, priority: 1 },
  // Ligue 1
  { ruleKey: 'ligue1_ca_bein', providerKey: 'bein_sports', label: 'beIN SPORTS', countryCodes: ['CA'], sportKeys: ['soccer'], leagueNamePattern: /ligue 1/i, priority: 1 },
  { ruleKey: 'ligue1_us_bein', providerKey: 'bein_sports', label: 'beIN SPORTS', countryCodes: ['US'], sportKeys: ['soccer'], leagueNamePattern: /ligue 1/i, priority: 1 },
  { ruleKey: 'ligue1_fr_canal', providerKey: 'canal_plus', label: 'CANAL+', countryCodes: ['FR'], sportKeys: ['soccer'], leagueNamePattern: /ligue 1/i, priority: 1 },

  // --- Major multi-sport routes (docs "Major Multi-Sport Watch Routes").
  // NBA
  { ruleKey: 'nba_global_leaguepass', providerKey: 'nba_league_pass', label: 'NBA League Pass', countryCodes: ['US', 'CA', 'GB', 'AU', 'IN'], sportKeys: ['basketball'], leagueNamePattern: /\bnba\b|national basketball/i, priority: 4 },
  { ruleKey: 'nba_us_prime', providerKey: 'prime_video', label: 'Prime Video', countryCodes: ['US'], sportKeys: ['basketball'], leagueNamePattern: /\bnba\b|national basketball/i, priority: 2 },
  { ruleKey: 'nba_us_espn', providerKey: 'espn_plus', label: 'ESPN', countryCodes: ['US'], sportKeys: ['basketball'], leagueNamePattern: /\bnba\b|national basketball/i, priority: 3 },
  // MLB
  { ruleKey: 'mlb_global_mlbtv', providerKey: 'mlb_tv', label: 'MLB.TV', countryCodes: ['US', 'CA', 'GB', 'AU', 'JP'], sportKeys: ['baseball'], leagueNamePattern: /\bmlb\b|major league baseball/i, priority: 4 },
  // Formula 1 (US is Apple TV from 2026; canonical country/broadcaster table on formula1.com)
  { ruleKey: 'f1_global_f1tv', providerKey: 'formula1_tv', label: 'F1 TV', countryCodes: [], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 5 },
  { ruleKey: 'f1_us_apple', providerKey: 'apple_tv', label: 'Apple TV', countryCodes: ['US'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  { ruleKey: 'f1_ca_tsn', providerKey: 'tsn', label: 'TSN / RDS', countryCodes: ['CA'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  { ruleKey: 'f1_gb_sky', providerKey: 'sky_sports', label: 'Sky Sports F1', countryCodes: ['GB', 'IE'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  { ruleKey: 'f1_gb_c4', providerKey: 'channel4', label: 'Channel 4 (highlights)', countryCodes: ['GB'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 2 },
  { ruleKey: 'f1_es_dazn', providerKey: 'dazn_es', label: 'DAZN', countryCodes: ['ES'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  { ruleKey: 'f1_fr_canal', providerKey: 'canal_plus', label: 'CANAL+', countryCodes: ['FR'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  { ruleKey: 'f1_de_sky', providerKey: 'sky_de', label: 'Sky Deutschland', countryCodes: ['DE', 'AT'], sportKeys: ['motorsport'], leagueNamePattern: /formula 1|formula one|\bf1\b/i, priority: 1 },
  // Tennis — Wimbledon official coverage page (Slam-specific rights)
  { ruleKey: 'tennis_wimbledon', providerKey: 'wimbledon_tv', label: 'Wimbledon', countryCodes: [], sportKeys: ['tennis'], leagueNamePattern: /wimbledon/i, priority: 2 },
]

function sportAliases(sportKey: string | null | undefined) {
  const key = sportKey?.toLowerCase()
  if (!key) return []
  const aliases: Record<string, string[]> = {
    combat_sports: ['combat_sports', 'combat', 'mma', 'boxing'],
    american_football: ['american_football', 'football', 'nfl', 'cfl'],
    athletics: ['athletics', 'track', 'track_field'],
    olympic_sports: ['olympic_sports', 'olympic'],
    motorsport: ['motorsport', 'f1'],
  }
  return aliases[key] ?? [key]
}

function includesOrGlobal(values: string[] | null | undefined, value: string | null | undefined) {
  if (!values?.length) return true
  if (!value) return false
  return values.includes(value.toUpperCase()) || values.includes(value.toLowerCase())
}

function includesSportOrGlobal(values: string[] | null | undefined, sportKey: string | null | undefined) {
  if (!values?.length) return true
  return sportAliases(sportKey).some((alias) => values.includes(alias))
}

function catalogWatchOptions(query: WatchQuery, limit: number): WatchOption[] {
  const region = (query.regionCode ?? 'US').toUpperCase()
  const leagueName = query.leagueName?.trim() ?? ''
  const seen = new Set<string>()

  return CATALOG_RULES
    .filter((rule) => {
      if (!includesOrGlobal(rule.countryCodes, region)) return false
      if (!includesSportOrGlobal(rule.sportKeys, query.sportKey)) return false
      return !rule.leagueNamePattern || rule.leagueNamePattern.test(leagueName)
    })
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    .flatMap((rule) => {
      const link = watchLinkFor(rule.providerKey)
      if (!link) return []
      return [{
        key: rule.ruleKey,
        name: rule.label || link.name,
        href: link.href,
        affiliate: link.affiliate,
        network: undefined,
        source: 'catalog' as const,
        priority: rule.priority,
      }]
    })
    .filter((option) => {
      const dedupeKey = `${option.name}:${option.href}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    })
    .slice(0, limit)
}

export function fallbackWatchOptions(regionCode?: string | null, sportKey?: string | null, limit = 5, leagueName?: string | null): WatchOption[] {
  const catalog = catalogWatchOptions({ regionCode, sportKey, leagueName }, limit)
  if (catalog.length) return catalog

  const region = (regionCode ?? 'US').toUpperCase()
  const exact = WATCH_PROVIDERS.filter(
    (p) =>
      p.regions.includes(region) &&
      includesSportOrGlobal(p.sports, sportKey),
  )
  const regional = WATCH_PROVIDERS.filter((p) => p.regions.includes(region))
  const providers = (exact.length ? exact : regional.length ? regional : WATCH_PROVIDERS).slice(0, limit)

  return providers.flatMap((provider, index) => {
    const link = watchLinkFor(provider.key)
    if (!link) return []
    return [{
      key: provider.key,
      name: link.name,
      href: link.href,
      affiliate: link.affiliate,
      network: provider.network,
      source: 'fallback' as const,
      priority: index + 100,
    }]
  })
}

function mapRows(rows: WatchLinkRow[], query: WatchQuery): WatchOption[] {
  const region = (query.regionCode ?? 'US').toUpperCase()
  const leagueName = query.leagueName?.trim() ?? ''
  const wantsWorldCup = WORLD_CUP_2026.test(leagueName)
  const seen = new Set<string>()

  return rows
    .filter((row) => {
      if (!row.watch_providers) return false
      if (row.event_id && row.event_id !== query.eventId) return false
      if (row.league_id && row.league_id !== query.leagueId) {
        const isWorldCupLeague = wantsWorldCup && row.sport_keys.includes('world_cup')
        if (!isWorldCupLeague) return false
      }
      if (!includesOrGlobal(row.country_codes, region)) return false
      if (!includesSportOrGlobal(row.sport_keys, query.sportKey)) return false
      if (wantsWorldCup && !row.event_id && !row.sport_keys.includes('world_cup')) return false
      return true
    })
    .map((row) => {
      const provider = row.watch_providers!
      const affiliateHref =
        provider.affiliate_status === 'approved'
          ? row.affiliate_url ?? provider.affiliate_url
          : null
      const href = affiliateHref ?? row.url ?? provider.direct_url
      const exactBoost = row.event_id ? -1000 : row.league_id ? -500 : 0
      const affiliate = Boolean(affiliateHref) || row.link_kind === 'affiliate' || row.link_kind === 'sponsored'
      return {
        key: `${row.provider_key}:${href}`,
        name: row.label ?? provider.name,
        href,
        affiliate,
        network: provider.network,
        source: 'db' as const,
        priority: row.priority + provider.priority + exactBoost + (affiliate ? -10 : 0),
      }
    })
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .filter((option) => {
      const dedupeKey = `${option.name}:${option.href}`
      if (seen.has(dedupeKey)) return false
      seen.add(dedupeKey)
      return true
    })
}

export function useWatchOptions(query: WatchQuery): { links: WatchOption[]; loading: boolean; configured: boolean } {
  const limit = query.limit ?? 5
  const fallback = fallbackWatchOptions(query.regionCode, query.sportKey, limit, query.leagueName)
  const [state, setState] = useState<{
    key: string
    links: WatchOption[]
    configured: boolean
  }>({ key: '', links: fallback, configured: true })
  const key = [
    query.eventId ?? '',
    query.leagueId ?? '',
    query.leagueName ?? '',
    query.sportKey ?? '',
    query.regionCode ?? '',
    limit,
  ].join('|')

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase) {
        if (!cancelled) setState({ key, links: fallback, configured: false })
        return
      }

      const { data, error } = await supabase
        .from('watch_links')
        .select(
          'provider_key, label, event_id, league_id, country_codes, sport_keys, link_kind, url, affiliate_url, priority, watch_providers(key, name, network, affiliate_status, direct_url, affiliate_url, priority)',
        )
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(100)

      if (cancelled) return
      if (error) {
        setState({ key, links: fallback, configured: true })
        return
      }

      const links = mapRows((data ?? []) as unknown as WatchLinkRow[], query).slice(0, limit)
      setState({ key, links: links.length ? links : fallback, configured: true })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const loading = state.key !== key
  return {
    links: loading ? fallback : state.links,
    loading,
    configured: state.configured,
  }
}
