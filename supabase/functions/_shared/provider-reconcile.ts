import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export type SourceConfidence = 'official' | 'provider' | 'cached' | 'manual' | 'placeholder'

export type CandidateEvent = {
  id: string
  title: string
  status: string
  starts_at: string | null
  version: number
  payload_hash: string | null
  provider_key: string | null
  provider_event_id: string | null
  league_id: string | null
  venue_id: string | null
  metadata: Record<string, unknown>
  matchConfidence: number
}

export type CandidateSearch = {
  sportId: string
  leagueId?: string | null
  venueId?: string | null
  title: string
  startsAt: string | null
  windowHours?: number
  metadataNeedles?: Array<string | null | undefined>
}

export async function payloadHash(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(value))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(grand prix|gp|formula 1|f1|race weekend|session)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function scoreTextMatch(a: string, b: string): number {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return 0
  if (left === right) return 30
  if (left.includes(right) || right.includes(left)) return 18
  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 2))
  const rightTokens = right.split(' ').filter((token) => token.length > 2)
  if (!leftTokens.size || !rightTokens.length) return 0
  const hits = rightTokens.filter((token) => leftTokens.has(token)).length
  return Math.min(16, Math.round((hits / Math.max(leftTokens.size, rightTokens.length)) * 20))
}

function scoreStartsAt(candidate: string | null, target: string | null): number {
  if (!candidate || !target) return 0
  const deltaMinutes = Math.abs(new Date(candidate).getTime() - new Date(target).getTime()) / 60_000
  if (deltaMinutes <= 10) return 35
  if (deltaMinutes <= 60) return 28
  if (deltaMinutes <= 180) return 20
  if (deltaMinutes <= 720) return 10
  return 0
}

function metadataText(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return ''
  try {
    return normalizeText(JSON.stringify(metadata))
  } catch {
    return ''
  }
}

export async function findLinkedEvent(
  db: SupabaseClient,
  providerKey: string,
  externalId: string,
): Promise<CandidateEvent | null> {
  const { data, error } = await db
    .from('event_external_ids')
    .select('event_id, events(id, title, status, starts_at, version, payload_hash, provider_key, provider_event_id, league_id, venue_id, metadata)')
    .eq('provider_key', providerKey)
    .eq('external_id', externalId)
    .maybeSingle()
  if (error) throw error
  const event = Array.isArray(data?.events) ? data?.events[0] : data?.events
  if (!event) return null
  return { ...(event as Omit<CandidateEvent, 'matchConfidence'>), matchConfidence: 100 }
}

export async function findCandidateEvent(db: SupabaseClient, search: CandidateSearch): Promise<CandidateEvent | null> {
  if (!search.startsAt) return null
  const startsAt = new Date(search.startsAt)
  const windowMs = (search.windowHours ?? 12) * 3600_000
  const from = new Date(startsAt.getTime() - windowMs).toISOString()
  const to = new Date(startsAt.getTime() + windowMs).toISOString()

  const { data, error } = await db
    .from('events')
    .select('id, title, status, starts_at, version, payload_hash, provider_key, provider_event_id, league_id, venue_id, metadata')
    .eq('sport_id', search.sportId)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .neq('visibility', 'private')
    .limit(80)
  if (error) throw error

  let best: CandidateEvent | null = null
  for (const row of (data ?? []) as Array<Omit<CandidateEvent, 'matchConfidence'>>) {
    let score = scoreStartsAt(row.starts_at, search.startsAt)
    if (search.leagueId && row.league_id === search.leagueId) score += 14
    if (search.venueId && row.venue_id === search.venueId) score += 22
    score += scoreTextMatch(row.title, search.title)

    const rowMetadata = metadataText(row.metadata)
    for (const needle of search.metadataNeedles ?? []) {
      const normalizedNeedle = normalizeText(needle)
      if (normalizedNeedle && rowMetadata.includes(normalizedNeedle)) score += 8
    }

    if (!best || score > best.matchConfidence) {
      best = { ...row, matchConfidence: Math.min(score, 98) }
    }
  }

  return best && best.matchConfidence >= 58 ? best : null
}

export async function linkExternalId(
  db: SupabaseClient,
  args: {
    eventId: string
    providerKey: string
    externalId: string
    rawUid?: string | null
    sourceTargetId?: string | null
    sourceConfidence?: SourceConfidence
    matchConfidence?: number
    payloadHash?: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await db.from('event_external_ids').upsert(
    {
      event_id: args.eventId,
      source_target_id: args.sourceTargetId ?? null,
      provider_key: args.providerKey,
      external_id: args.externalId,
      raw_uid: args.rawUid ?? null,
      source_confidence: args.sourceConfidence ?? 'provider',
      match_confidence: args.matchConfidence ?? 100,
      payload_hash: args.payloadHash ?? null,
      last_seen_at: new Date().toISOString(),
      metadata: args.metadata ?? {},
    },
    { onConflict: 'provider_key,external_id' },
  )
  if (error) throw error
}

export async function upsertProviderEventSource(
  db: SupabaseClient,
  args: {
    eventId?: string | null
    providerKey: string
    externalId: string
    sportKey: string
    providerLeagueId?: string | null
    title: string
    startsAt: string | null
    status: string
    sourceConfidence?: SourceConfidence
    matchConfidence?: number
    payloadHash?: string | null
    rawPayload: unknown
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await db.from('provider_event_sources').upsert(
    {
      event_id: args.eventId ?? null,
      provider_key: args.providerKey,
      external_id: args.externalId,
      sport_key: args.sportKey,
      provider_league_id: args.providerLeagueId ?? null,
      normalized_title: normalizeText(args.title),
      starts_at: args.startsAt,
      status: args.status,
      source_confidence: args.sourceConfidence ?? 'provider',
      match_confidence: args.matchConfidence ?? 100,
      payload_hash: args.payloadHash ?? null,
      raw_payload: args.rawPayload ?? {},
      metadata: args.metadata ?? {},
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'provider_key,external_id' },
  )
  if (error) throw error
}
