import { createClient } from 'npm:@supabase/supabase-js@2'
import { payloadHash, upsertProviderEventSource } from '../_shared/provider-reconcile.ts'

const PROVIDER_KEY = 'tfrrs'
const SPORT_KEY = 'athletics'
const PROVIDER_LEAGUE_ID = 'results-search'
const URL = Deno.env.get('TFRRS_RESULTS_URL') ?? 'https://www.tfrrs.org/results_search.html'
const LIMIT = Number(Deno.env.get('TFRRS_DRY_RUN_LIMIT') ?? 100)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function htmlDecode(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
}

function stripTags(value = '') {
  return htmlDecode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function parseDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return null
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
  const month = Number(match[1])
  const day = Number(match[2])
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString()
}

Deno.serve(async (req) => {
  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const limit = Math.max(1, Math.min(Number(body.limit ?? LIMIT), 500))
  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  try {
    const response = await fetch(URL, {
      headers: { 'user-agent': 'SilboSportsBridgeAdapter/0.1 (+https://silbosports.com)' },
    })
    if (!response.ok) throw new Error(`TFRRS results search -> ${response.status}`)
    const html = await response.text()
    const matches = [
      ...html.matchAll(/<tr>\s*<td>(.*?)<\/td>\s*<td><a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a><\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/g),
    ].slice(0, limit)

    let changed = 0
    for (const match of matches) {
      const resultDate = stripTags(match[1])
      const href = htmlDecode(match[2])
      const title = stripTags(match[3])
      const sportLabel = stripTags(match[4])
      const stateOrProvince = stripTags(match[5])
      const externalId = href.replace(/^https?:\/\/www\.tfrrs\.org/i, '')
      const startsAt = parseDate(resultDate)
      const metadata = {
        source: PROVIDER_KEY,
        dry_run: true,
        result_date: resultDate,
        sport_label: sportLabel,
        state_or_province: stateOrProvince,
        url: href.startsWith('http') ? href : `https://www.tfrrs.org${href}`,
      }
      const hash = await payloadHash({ title, startsAt, metadata })
      await upsertProviderEventSource(supabase, {
        providerKey: PROVIDER_KEY,
        externalId,
        sportKey: SPORT_KEY,
        providerLeagueId: PROVIDER_LEAGUE_ID,
        title,
        startsAt,
        status: 'finished',
        sourceConfidence: 'cached',
        matchConfidence: 0,
        payloadHash: hash,
        rawPayload: { date: resultDate, href, title, sportLabel, stateOrProvince },
        metadata,
      })
      changed += 1
    }

    await supabase
      .from('provider_targets')
      .update({
        events_synced_at: new Date().toISOString(),
        next_synced_at: new Date().toISOString(),
        last_status: `dry_run_result_sources:${changed}`,
        last_error: null,
      })
      .eq('provider_key', PROVIDER_KEY)
      .eq('provider_league_id', PROVIDER_LEAGUE_ID)

    await supabase
      .from('provider_sync_runs')
      .update({ status: 'success', fetched_count: matches.length, changed_count: changed, finished_at: new Date().toISOString() })
      .eq('id', run!.id)

    return Response.json({ ok: true, dryRun: true, fetched: matches.length, changed })
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  }
})
