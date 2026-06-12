// Provider sync (plan Objective 4). Pulls events from one adapter, normalizes them into
// Postgres, diffs before bumping version, and records the run in provider_sync_runs.
//
// Versioning rule (review-corrected):
//   - version bumps when ANY calendar-visible field changes (time, status, title, venue) so
//     subscribed calendars re-render, but never on a no-change sync run.
//   - event_status_history rows are written ONLY for starts_at/status changes — that table
//     drives user-facing change notifications, and venue typo fixes should not notify.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { worldCupJsonAdapter } from './providers/worldcup-json.ts'
import type { ProviderEvent, ProviderKey, SportsProviderAdapter } from './providers/types.ts'

const adapters: Record<string, SportsProviderAdapter> = {
  [worldCupJsonAdapter.key]: worldCupJsonAdapter,
}

const sportKeyAliases: Record<string, string> = {
  f1: 'motorsport',
  nhl: 'hockey',
  nba: 'basketball',
  wnba: 'basketball',
  ufc: 'mma',
  pfl: 'mma',
  cfl: 'american_football',
}

function canonicalSportKey(input: string) {
  return sportKeyAliases[input] ?? input
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function ensureCompetitor(
  db: SupabaseClient,
  sportId: string,
  leagueId: string | null,
  competitor: ProviderEvent['competitors'][number],
  providerKey: ProviderKey,
): Promise<string> {
  const { data: existing } = await db
    .from('competitors')
    .select('id')
    .eq('provider_key', providerKey)
    .eq('provider_competitor_id', competitor.providerCompetitorId ?? competitor.name)
    .maybeSingle()
  if (existing) return existing.id

  const { data: inserted, error } = await db
    .from('competitors')
    .insert({
      sport_id: sportId,
      league_id: leagueId,
      kind: competitor.role === 'driver' || competitor.role === 'player' ? 'person' : 'team',
      name: competitor.name,
      short_name: competitor.shortName ?? null,
      country: competitor.country ?? null,
      provider_key: providerKey,
      provider_competitor_id: competitor.providerCompetitorId ?? competitor.name,
    })
    .select('id')
    .single()
  if (error) throw error
  return inserted.id
}

// Fields whose change is visible in a subscribed calendar and must bump SEQUENCE.
function calendarVisibleChanged(
  existing: { title: string; status: string; starts_at: string | null },
  next: { title: string; status: string; starts_at: string | null },
) {
  return existing.title !== next.title || existing.status !== next.status || existing.starts_at !== next.starts_at
}

function changeLogRows(
  eventId: string,
  providerKey: ProviderKey,
  existing: { title: string; status: string; starts_at: string | null },
  next: { title: string; status: string; starts_at: string | null },
) {
  const rows = []
  if (existing.starts_at !== next.starts_at) {
    rows.push({
      event_id: eventId,
      change_type: 'time_change',
      significance: 'notify',
      old_value: { starts_at: existing.starts_at },
      new_value: { starts_at: next.starts_at },
      source: providerKey,
    })
  }
  if (existing.status !== next.status) {
    rows.push({
      event_id: eventId,
      change_type: next.status === 'cancelled' ? 'cancellation' : 'status_change',
      significance: next.status === 'cancelled' ? 'notify' : 'calendar',
      old_value: { status: existing.status },
      new_value: { status: next.status },
      source: providerKey,
    })
  }
  if (existing.title !== next.title) {
    rows.push({
      event_id: eventId,
      change_type: 'title_change',
      significance: 'calendar',
      old_value: { title: existing.title },
      new_value: { title: next.title },
      source: providerKey,
    })
  }
  return rows
}

async function upsertNormalizedEvent(db: SupabaseClient, providerEvent: ProviderEvent, sportId: string, leagueId: string | null) {
  const next = {
    title: providerEvent.title,
    status: providerEvent.status,
    starts_at: providerEvent.startsAt ?? null,
  }

  const { data: existing } = await db
    .from('events')
    .select('id, title, status, starts_at, version')
    .eq('provider_key', providerEvent.providerKey)
    .eq('provider_event_id', providerEvent.providerEventId)
    .maybeSingle()

  let eventId: string
  let changed = false

  if (existing) {
    eventId = existing.id
    const visibleChange = calendarVisibleChanged(existing, next)
    const changeRows = changeLogRows(eventId, providerEvent.providerKey, existing, next)
    changed = visibleChange

    const { error } = await db
      .from('events')
      .update({
        ...next,
        short_title: providerEvent.shortTitle ?? null,
        starts_at_tbd: providerEvent.startsAtTbd ?? false,
        timezone: providerEvent.timezone ?? null,
        metadata: providerEvent.metadata,
        version: visibleChange ? existing.version + 1 : existing.version,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
    if (error) throw error

    if (changeRows.length) {
      await db.from('event_change_log').insert(changeRows)
    }
  } else {
    const { data: inserted, error } = await db
      .from('events')
      .insert({
        sport_id: sportId,
        league_id: leagueId,
        provider_key: providerEvent.providerKey,
        provider_event_id: providerEvent.providerEventId,
        kind: providerEvent.kind,
        visibility: 'public',
        ...next,
        short_title: providerEvent.shortTitle ?? null,
        starts_at_tbd: providerEvent.startsAtTbd ?? false,
        timezone: providerEvent.timezone ?? null,
        metadata: providerEvent.metadata,
      })
      .select('id')
      .single()
    if (error) throw error
    eventId = inserted.id
    changed = true
    await db.from('event_change_log').insert({
      event_id: eventId,
      change_type: 'new_event',
      significance: 'calendar',
      old_value: null,
      new_value: next,
      source: providerEvent.providerKey,
    })
  }

  // Participation + broadcasts are replaced wholesale per sync (source of truth = provider).
  const competitorRows = []
  for (const competitor of providerEvent.competitors) {
    const competitorId = await ensureCompetitor(db, sportId, leagueId, competitor, providerEvent.providerKey)
    competitorRows.push({ event_id: eventId, competitor_id: competitorId, role: competitor.role })
  }
  await db.from('event_competitors').delete().eq('event_id', eventId)
  if (competitorRows.length) await db.from('event_competitors').insert(competitorRows)

  if (providerEvent.broadcasts?.length) {
    await db.from('broadcasts').delete().eq('event_id', eventId)
    await db.from('broadcasts').insert(
      providerEvent.broadcasts.map((broadcast) => ({
        event_id: eventId,
        country: broadcast.country,
        channel: broadcast.channel,
        stream_url: broadcast.streamUrl ?? null,
      })),
    )
  }

  return changed
}

Deno.serve(async (req) => {
  const { providerKey, sportKey, leagueId, from, to } = await req.json()
  const canonicalSport = canonicalSportKey(sportKey)
  const adapter = adapters[providerKey as string]
  if (!adapter) return Response.json({ error: `Unknown provider: ${providerKey}` }, { status: 400 })

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: providerKey, sport_key: canonicalSport, league_id: leagueId ?? null, status: 'running' })
    .select('id')
    .single()

  try {
    const { data: sport } = await supabase.from('sports').select('id').eq('key', canonicalSport).single()
    if (!sport) throw new Error(`Unknown sport: ${canonicalSport}`)

    const providerEvents = await adapter.listEvents({ from, to })
    let changedCount = 0
    for (const providerEvent of providerEvents) {
      if (await upsertNormalizedEvent(supabase, providerEvent, sport.id, leagueId ?? null)) changedCount += 1
    }

    await supabase
      .from('provider_sync_runs')
      .update({ status: 'success', fetched_count: providerEvents.length, changed_count: changedCount, finished_at: new Date().toISOString() })
      .eq('id', run!.id)

    return Response.json({ ok: true, fetched: providerEvents.length, changed: changedCount })
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  }
})
