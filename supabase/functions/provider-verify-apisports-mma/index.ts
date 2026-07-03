import { createClient } from 'npm:@supabase/supabase-js@2'

const PROVIDER_KEY = 'apisports_mma'
const SPORT_KEY = 'combat_sports'
const PROVIDER_LEAGUE_ID = 'mma'
const API_KEY = Deno.env.get('APISPORTS_KEY') ?? ''
const BASE = Deno.env.get('APISPORTS_MMA_BASE_URL') ?? 'https://v1.mma.api-sports.io'
const CALL_BUDGET = Number(Deno.env.get('APISPORTS_MMA_VERIFY_CALL_BUDGET') ?? 3)
const CALL_SPACING_MS = Number(Deno.env.get('APISPORTS_MMA_SPACING_MS') ?? 1200)

const HISTORICAL_SCHEMA_SEASON = Deno.env.get('APISPORTS_MMA_SCHEMA_SEASON') ?? '2024'
const DEFAULT_PATHS = ['/status', '/categories', `/fights?season=${encodeURIComponent(HISTORICAL_SCHEMA_SEASON)}`]

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type EndpointReport = {
  path: string
  ok: boolean
  status: number
  results: number | null
  responseType: string
  sampleKeys: string[]
  providerErrors: unknown
  sample: unknown
}

function responseType(value: unknown) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

function sampleKeys(value: unknown) {
  const sample = Array.isArray(value) ? value[0] : value
  return sample && typeof sample === 'object' ? Object.keys(sample as Record<string, unknown>).slice(0, 20) : []
}

function compactSample(value: unknown) {
  const sample = Array.isArray(value) ? value[0] : value
  if (!sample || typeof sample !== 'object') return sample ?? null
  return Object.fromEntries(Object.entries(sample as Record<string, unknown>).slice(0, 12))
}

Deno.serve(async (req) => {
  if (!API_KEY) return Response.json({ ok: false, error: 'APISPORTS_KEY not configured' }, { status: 500 })
  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const requestedPaths = Array.isArray(body.paths) ? body.paths.filter((path): path is string => typeof path === 'string') : DEFAULT_PATHS
  const paths = requestedPaths.slice(0, CALL_BUDGET)
  const reports: EndpointReport[] = []

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  try {
    for (const path of paths) {
      await sleep(CALL_SPACING_MS)
      const response = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': API_KEY } })
      const text = await response.text()
      let json: Record<string, unknown> = {}
      try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
      } catch {
        reports.push({
          path,
          ok: false,
          status: response.status,
          results: null,
          responseType: 'non-json',
          sampleKeys: [],
          providerErrors: text.slice(0, 300),
          sample: null,
        })
        continue
      }

      const payload = json.response ?? json
      reports.push({
        path,
        ok: response.ok && !(json.errors && typeof json.errors === 'object' && Object.keys(json.errors as Record<string, unknown>).length),
        status: response.status,
        results: typeof json.results === 'number' ? json.results : Array.isArray(payload) ? payload.length : null,
        responseType: responseType(payload),
        sampleKeys: sampleKeys(payload),
        providerErrors: json.errors ?? null,
        sample: compactSample(payload),
      })
    }

    const successful = reports.filter((report) => report.ok).length
    const fightReport = reports.find((report) => report.path.startsWith('/fights'))
    await supabase
      .from('provider_targets')
      .update({
        verified_at: new Date().toISOString(),
        next_synced_at: new Date().toISOString(),
        last_status: `verify:ok:${successful}/${reports.length}:fights:${fightReport?.results ?? 'unknown'}`,
        last_error: successful ? null : JSON.stringify(reports.map((report) => ({ path: report.path, status: report.status, errors: report.providerErrors }))),
      })
      .eq('provider_key', PROVIDER_KEY)
      .eq('provider_league_id', PROVIDER_LEAGUE_ID)

    await supabase
      .from('provider_sync_runs')
      .update({
        status: 'success',
        fetched_count: reports.reduce((sum, report) => sum + (report.results ?? 0), 0),
        changed_count: 0,
        error: successful ? null : 'No API-Sports MMA verifier endpoint returned a clean response',
        finished_at: new Date().toISOString(),
      })
      .eq('id', run!.id)

    return Response.json({ ok: successful > 0, reports })
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error), reports }, { status: 500 })
  }
})
