import { createClient } from 'npm:@supabase/supabase-js@2'

const PROVIDER_KEY = 'cricsheet'
const SPORT_KEY = 'cricket'
const PROVIDER_LEAGUE_ID = 'people-register'
const PEOPLE_URL = Deno.env.get('CRICSHEET_PEOPLE_URL') ?? 'https://cricsheet.org/register/people.csv'
const NAMES_URL = Deno.env.get('CRICSHEET_NAMES_URL') ?? 'https://cricsheet.org/register/names.csv'
const LIMIT = Number(Deno.env.get('CRICSHEET_IDENTITY_LIMIT') ?? 25000)

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type CsvRow = Record<string, string>

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted && char === '"' && next === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (!quoted && char === ',') {
      row.push(cell)
      cell = ''
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.length)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((value) => value.length)) rows.push(row)
  }

  const headers = rows.shift() ?? []
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])),
  )
}

function normalizeAlias(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchCsv(url: string) {
  const response = await fetch(url, { headers: { 'user-agent': 'SilboSportsBridgeAdapter/0.1 (+https://silbosports.com)' } })
  if (!response.ok) throw new Error(`${url} -> ${response.status}`)
  return parseCsv(await response.text())
}

async function ensureSportId() {
  const { data, error } = await supabase.from('sports').select('id').eq('key', SPORT_KEY).single()
  if (error) throw error
  if (!data) throw new Error(`Unknown sport key ${SPORT_KEY}`)
  return data.id as string
}

Deno.serve(async (req) => {
  const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {}
  const limit = Math.max(1, Math.min(Number(body.limit ?? LIMIT), 50000))
  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: PROVIDER_KEY, sport_key: SPORT_KEY, status: 'running' })
    .select('id')
    .single()

  try {
    const sportId = await ensureSportId()
    const [peopleRows, aliasRows] = await Promise.all([fetchCsv(PEOPLE_URL), fetchCsv(NAMES_URL)])
    const people = peopleRows
      .filter((row) => row.identifier && row.name)
      .slice(0, limit)
      .map((row) => ({
        identifier: row.identifier,
        name: row.name,
        uniqueName: row.unique_name || row.name,
        keys: Object.fromEntries(
          Object.entries(row)
            .filter(([key, value]) => key.startsWith('key_') && value)
            .map(([key, value]) => [key, value]),
        ),
      }))

    for (let i = 0; i < people.length; i += 500) {
      const chunk = people.slice(i, i + 500)
      const { error } = await supabase.from('competitors').upsert(
        chunk.map((person) => ({
          sport_id: sportId,
          kind: 'person',
          name: person.uniqueName,
          short_name: person.name,
          provider_key: PROVIDER_KEY,
          provider_competitor_id: person.identifier,
          theme: {
            source: PROVIDER_KEY,
            register: 'people.csv',
            external_keys: person.keys,
            image_rights: 'none',
          },
        })),
        { onConflict: 'provider_key,provider_competitor_id' },
      )
      if (error) throw error
    }

    const competitorIds = new Map<string, string>()
    const identifiers = people.map((person) => person.identifier)
    for (let i = 0; i < identifiers.length; i += 500) {
      const { data, error } = await supabase
        .from('competitors')
        .select('id, provider_competitor_id')
        .eq('provider_key', PROVIDER_KEY)
        .in('provider_competitor_id', identifiers.slice(i, i + 500))
      if (error) throw error
      for (const row of data ?? []) competitorIds.set(row.provider_competitor_id, row.id)
    }

    const aliases = new Map<string, { providerId: string; alias: string; competitorId: string | null; source: string }>()
    for (const person of people) {
      const competitorId = competitorIds.get(person.identifier) ?? null
      for (const alias of [person.name, person.uniqueName]) {
        const normalized = normalizeAlias(alias)
        if (normalized) aliases.set(`${person.identifier}:${normalized}`, { providerId: person.identifier, alias, competitorId, source: 'people.csv' })
      }
    }
    for (const row of aliasRows) {
      if (!row.identifier || !row.name || !competitorIds.has(row.identifier)) continue
      const normalized = normalizeAlias(row.name)
      if (!normalized) continue
      aliases.set(`${row.identifier}:${normalized}`, {
        providerId: row.identifier,
        alias: row.name,
        competitorId: competitorIds.get(row.identifier) ?? null,
        source: 'names.csv',
      })
    }

    const aliasPayload = [...aliases.values()].map((alias) => ({
      competitor_id: alias.competitorId,
      provider_key: PROVIDER_KEY,
      provider_competitor_id: alias.providerId,
      alias: alias.alias,
      normalized_alias: normalizeAlias(alias.alias),
      source_confidence: 'provider',
      metadata: { source: PROVIDER_KEY, register: alias.source },
      last_seen_at: new Date().toISOString(),
    }))

    for (let i = 0; i < aliasPayload.length; i += 500) {
      const { error } = await supabase
        .from('competitor_aliases')
        .upsert(aliasPayload.slice(i, i + 500), { onConflict: 'provider_key,provider_competitor_id,normalized_alias' })
      if (error) throw error
    }

    await supabase
      .from('provider_targets')
      .update({
        teams_synced_at: new Date().toISOString(),
        events_synced_at: new Date().toISOString(),
        last_status: `identity_batch:people:${people.length}:aliases:${aliasPayload.length}`,
        last_error: null,
      })
      .eq('provider_key', PROVIDER_KEY)
      .eq('provider_league_id', PROVIDER_LEAGUE_ID)

    await supabase
      .from('provider_sync_runs')
      .update({
        status: 'success',
        fetched_count: people.length,
        changed_count: people.length + aliasPayload.length,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run!.id)

    return Response.json({ ok: true, people: people.length, aliases: aliasPayload.length })
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  }
})
