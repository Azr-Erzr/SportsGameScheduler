import { createClient } from 'npm:@supabase/supabase-js@2'
import { payloadHash, upsertProviderEventSource } from '../_shared/provider-reconcile.ts'

const PROVIDER_KEY = 'world_athletics_calendar'
const SPORT_KEY = 'athletics'
const PROVIDER_LEAGUE_ID = 'global-calendar'
const BASE_URL = Deno.env.get('WORLD_ATHLETICS_CALENDAR_URL') ?? 'https://worldathletics.org/competition/calendar-results'
const LIMIT = Number(Deno.env.get('WORLD_ATHLETICS_DRY_RUN_LIMIT') ?? 250)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type WaCalendarEvent = {
  id?: string | number | null
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  venue?: string | null
  area?: { name?: string | null; countryCode?: string | null } | string | null
  disciplines?: string[] | string | null
  competitionGroup?: string | null
  rankingCategory?: string | null
  hasResults?: boolean | null
  hasApiResults?: boolean | null
  hasStartlist?: boolean | null
}

function nextData(html: string) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('World Athletics page did not expose __NEXT_DATA__')
  return JSON.parse(match[1]) as Record<string, unknown>
}

function areaName(area: WaCalendarEvent['area']) {
  if (!area) return null
  return typeof area === 'string' ? area : area.name ?? area.countryCode ?? null
}

function toIsoDate(value: string | null | undefined) {
  if (!value) return null
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function statusFor(row: WaCalendarEvent) {
  const now = Date.now()
  const starts = row.startDate ? new Date(row.startDate).getTime() : null
  const ends = row.endDate ? new Date(`${row.endDate}T23:59:59Z`).getTime() : starts
  if (ends && ends < now) return 'finished'
  if (starts && ends && starts <= now && ends >= now) return 'live'
  return 'scheduled'
}

Deno.serve(async (req) => {
  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const limit = Math.max(1, Math.min(Number(body.limit ?? LIMIT), 1000))
  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  try {
    const response = await fetch(BASE_URL, {
      headers: { 'user-agent': 'SilboSportsBridgeAdapter/0.1 (+https://silbosports.com)' },
    })
    if (!response.ok) throw new Error(`World Athletics calendar -> ${response.status}`)
    const html = await response.text()
    const data = nextData(html)
    const initialEvents = (data as { props?: { pageProps?: { initialEvents?: { results?: WaCalendarEvent[]; hits?: number } } } })
      .props?.pageProps?.initialEvents
    const rows = (initialEvents?.results ?? []).slice(0, limit)

    let changed = 0
    for (const row of rows) {
      const externalId = String(row.id ?? `${row.name}:${row.startDate}:${row.venue}`)
      const title = row.name?.trim() || 'World Athletics event'
      const startsAt = toIsoDate(row.startDate)
      const status = statusFor(row)
      const metadata = {
        source: PROVIDER_KEY,
        dry_run: true,
        end_date: row.endDate ?? null,
        venue: row.venue ?? null,
        area: areaName(row.area),
        disciplines: row.disciplines ?? null,
        competition_group: row.competitionGroup ?? null,
        ranking_category: row.rankingCategory ?? null,
        has_results: row.hasResults ?? null,
        has_api_results: row.hasApiResults ?? null,
        has_startlist: row.hasStartlist ?? null,
        total_advertised: initialEvents?.hits ?? null,
      }
      const hash = await payloadHash({ title, startsAt, status, metadata })
      await upsertProviderEventSource(supabase, {
        providerKey: PROVIDER_KEY,
        externalId,
        sportKey: SPORT_KEY,
        providerLeagueId: PROVIDER_LEAGUE_ID,
        title,
        startsAt,
        status,
        sourceConfidence: 'provider',
        matchConfidence: 0,
        payloadHash: hash,
        rawPayload: row,
        metadata,
      })
      changed += 1
    }

    await supabase
      .from('provider_targets')
      .update({
        events_synced_at: new Date().toISOString(),
        next_synced_at: new Date().toISOString(),
        last_status: `dry_run_sources:${changed}:advertised:${initialEvents?.hits ?? 'unknown'}`,
        last_error: null,
      })
      .eq('provider_key', PROVIDER_KEY)
      .eq('provider_league_id', PROVIDER_LEAGUE_ID)

    await supabase
      .from('provider_sync_runs')
      .update({ status: 'success', fetched_count: rows.length, changed_count: changed, finished_at: new Date().toISOString() })
      .eq('id', run!.id)

    return Response.json({ ok: true, dryRun: true, fetched: rows.length, changed, totalAdvertised: initialEvents?.hits ?? null })
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  }
})
