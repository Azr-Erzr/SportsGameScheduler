// Allowlisted public ICS/webcal ingestion (MP4 4.4).
// Fetches source_targets, parses VEVENTs, hashes payloads, and upserts canonical events.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { externalIcsId, hashIcsEvent, parseIcsFeed, sha256Hex, type IcsFeedEvent } from '../_shared/ics-feed.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type SourceTarget = {
  id: string
  target_key: string
  source_type: 'ics' | 'webcal'
  url: string
  sport_key: string
  league_id: string | null
  expected_name: string
  source_confidence: 'official' | 'provider' | 'cached' | 'manual' | 'placeholder'
  dry_run: boolean
  cadence_minutes: number
  payload_hash: string | null
  last_checked_at: string | null
}

type ExistingEvent = {
  id: string
  title: string
  status: string
  starts_at: string | null
  version: number
  payload_hash: string | null
}

function due(target: SourceTarget, now: number) {
  if (!target.last_checked_at) return true
  return now - new Date(target.last_checked_at).getTime() >= target.cadence_minutes * 60_000
}

function fetchUrl(url: string) {
  return url.replace(/^webcal:\/\//i, 'https://')
}

function kindForSport(sportKey: string) {
  if (sportKey === 'motorsport' || sportKey === 'cycling') return 'race'
  if (sportKey === 'combat_sports') return 'fight_card'
  return 'match'
}

async function ensureVenueId(location: string | null) {
  if (!location) return null
  const name = location.slice(0, 240)
  await supabase.from('venues').upsert({ name }, { onConflict: 'name' })
  const { data } = await supabase.from('venues').select('id').eq('name', name).maybeSingle()
  return data?.id ?? null
}

async function upsertIcsEvent(target: SourceTarget, sportId: string, event: IcsFeedEvent) {
  if (!event.startsAt) return { skipped: true, changed: false }

  const providerKey = 'ics_feed'
  const externalId = externalIcsId(target.target_key, event.uid)
  const eventHash = await hashIcsEvent(event)
  const venueId = await ensureVenueId(event.location)

  const { data: linked } = await supabase
    .from('event_external_ids')
    .select('event_id')
    .eq('provider_key', providerKey)
    .eq('external_id', externalId)
    .maybeSingle()

  let existing: ExistingEvent | null = null
  if (linked?.event_id) {
    const { data } = await supabase
      .from('events')
      .select('id, title, status, starts_at, version, payload_hash')
      .eq('id', linked.event_id)
      .maybeSingle()
    existing = data as ExistingEvent | null
  } else {
    const { data } = await supabase
      .from('events')
      .select('id, title, status, starts_at, version, payload_hash')
      .eq('provider_key', providerKey)
      .eq('provider_event_id', externalId)
      .maybeSingle()
    existing = data as ExistingEvent | null
  }

  const checkedAt = new Date().toISOString()
  const metadata = {
    source: providerKey,
    source_target_id: target.id,
    raw_uid: event.uid,
    sequence: event.sequence,
    all_day: event.allDay,
    ends_at: event.endsAt,
    timezone: event.timezone,
    description: event.description,
    url: event.url,
  }

  if (existing) {
    if (existing.payload_hash === eventHash) {
      await supabase.from('events').update({ last_checked_at: checkedAt }).eq('id', existing.id)
      return { skipped: false, changed: false }
    }

    const visibleChange =
      existing.title !== event.summary || existing.status !== event.status || existing.starts_at !== event.startsAt
    const updatePayload: Record<string, unknown> = {
      title: event.summary,
      status: event.status,
      starts_at: event.startsAt,
      starts_at_tbd: false,
      venue_id: venueId,
      metadata,
      payload_hash: eventHash,
      last_checked_at: checkedAt,
      source_confidence: target.source_confidence,
      version: visibleChange ? existing.version + 1 : existing.version,
    }
    if (visibleChange) updatePayload.updated_at = checkedAt

    const { error } = await supabase.from('events').update(updatePayload).eq('id', existing.id)
    if (error) throw error

    if (existing.starts_at !== event.startsAt || existing.status !== event.status) {
      await supabase.from('event_status_history').insert({
        event_id: existing.id,
        old_status: existing.status,
        new_status: event.status,
        old_starts_at: existing.starts_at,
        new_starts_at: event.startsAt,
        source: providerKey,
      })
    }

    await supabase.from('event_external_ids').upsert(
      {
        event_id: existing.id,
        source_target_id: target.id,
        provider_key: providerKey,
        external_id: externalId,
        raw_uid: event.uid,
      },
      { onConflict: 'provider_key,external_id' },
    )
    return { skipped: false, changed: visibleChange }
  }

  const { data: inserted, error } = await supabase
    .from('events')
    .insert({
      sport_id: sportId,
      league_id: target.league_id,
      venue_id: venueId,
      provider_key: providerKey,
      provider_event_id: externalId,
      kind: kindForSport(target.sport_key),
      status: event.status,
      title: event.summary,
      starts_at: event.startsAt,
      starts_at_tbd: false,
      visibility: 'public',
      metadata,
      payload_hash: eventHash,
      last_checked_at: checkedAt,
      source_confidence: target.source_confidence,
    })
    .select('id')
    .single()
  if (error) throw error

  await supabase.from('event_external_ids').insert({
    event_id: inserted.id,
    source_target_id: target.id,
    provider_key: providerKey,
    external_id: externalId,
    raw_uid: event.uid,
  })

  return { skipped: false, changed: true }
}

Deno.serve(async (req) => {
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const targetId = typeof body.targetId === 'string' ? body.targetId : null
  const dryRunOverride = body.dryRun === true
  const limit = Math.min(Math.max(Number(body.limit ?? 3), 1), 10)
  const now = Date.now()

  let query = supabase
    .from('source_targets')
    .select('id, target_key, source_type, url, sport_key, league_id, expected_name, source_confidence, dry_run, cadence_minutes, payload_hash, last_checked_at')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(limit)
  if (targetId) query = query.eq('id', targetId)

  const { data: rows, error: targetError } = await query
  if (targetError) return Response.json({ ok: false, error: targetError.message }, { status: 500 })

  const targets = ((rows ?? []) as SourceTarget[]).filter((target) => targetId || due(target, now))
  const results = []

  for (const target of targets) {
    const checkedAt = new Date().toISOString()
    try {
      const response = await fetch(fetchUrl(target.url), {
        headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5' },
      })
      if (!response.ok) throw new Error(`fetch ${response.status}`)
      const text = await response.text()
      const feedHash = await sha256Hex(text)
      const parsed = parseIcsFeed(text)

      if (target.payload_hash === feedHash && !dryRunOverride) {
        await supabase
          .from('source_targets')
          .update({ last_checked_at: checkedAt, last_status: `unchanged:${parsed.events.length}`, last_error: null })
          .eq('id', target.id)
        results.push({ targetKey: target.target_key, status: 'unchanged', events: parsed.events.length })
        continue
      }

      if (target.dry_run || dryRunOverride) {
        await supabase
          .from('source_targets')
          .update({
            payload_hash: feedHash,
            last_checked_at: checkedAt,
            last_changed_at: target.payload_hash === feedHash ? null : checkedAt,
            last_status: `dry_run:${parsed.events.length}`,
            last_error: null,
          })
          .eq('id', target.id)
        results.push({ targetKey: target.target_key, status: 'dry_run', events: parsed.events.length, title: parsed.title })
        continue
      }

      const { data: sport } = await supabase.from('sports').select('id').eq('key', target.sport_key).single()
      if (!sport) throw new Error(`unknown sport ${target.sport_key}`)

      let changed = 0
      let skipped = 0
      for (const event of parsed.events) {
        const result = await upsertIcsEvent(target, sport.id, event)
        if (result.skipped) skipped += 1
        if (result.changed) changed += 1
      }

      await supabase
        .from('source_targets')
        .update({
          payload_hash: feedHash,
          last_checked_at: checkedAt,
          last_changed_at: changed ? checkedAt : target.payload_hash === feedHash ? null : checkedAt,
          events_synced_at: checkedAt,
          last_status: `synced:${parsed.events.length}:changed:${changed}:skipped:${skipped}`,
          last_error: null,
        })
        .eq('id', target.id)

      results.push({ targetKey: target.target_key, status: 'synced', events: parsed.events.length, changed, skipped })
    } catch (error) {
      await supabase
        .from('source_targets')
        .update({ last_checked_at: checkedAt, last_status: 'error', last_error: String(error) })
        .eq('id', target.id)
      results.push({ targetKey: target.target_key, status: 'error', error: String(error) })
    }
  }

  return Response.json({ ok: true, processed: results.length, results })
})
