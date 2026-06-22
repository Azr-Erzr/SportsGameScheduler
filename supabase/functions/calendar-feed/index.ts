// GET /calendar-feed/:token.ics — live subscribed calendar (plan Objective 6).
// Token is unguessable, so the feed works without login. Service role resolves the token;
// RLS is intentionally bypassed here because the feed row itself is the authorization.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderCalendar, type FeedEvent } from '../_shared/ics.ts'
import { checkRateLimit, rateLimitKey, rateLimitedResponse } from '../_shared/rate-limit.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const APP_URL = Deno.env.get('APP_URL') ?? 'https://silbosports.com'

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

type EventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean | null
  updated_at: string
  version: number
  status: string
  metadata: Record<string, unknown> | null
  venues: { name: string } | null
  sports: { key: string } | null
  leagues: { name: string } | null
  broadcasts?: Array<{ country: string | null; channel: string | null; kind: string | null; stream_url: string | null }>
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  const token = last.endsWith('.ics') ? last.slice(0, -4) : last

  if (!token) return new Response('Not found', { status: 404 })
  const tokenHash = await sha256Hex(token)
  const limit = checkRateLimit(rateLimitKey(req, 'calendar-feed', tokenHash), { limit: 120, windowMs: 60_000 })
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSeconds)

  const { data: feed } = await supabase
    .from('calendar_feeds')
    .select('id, name, timezone, filters, is_active, include_placeholders, include_broadcasts')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!feed || !feed.is_active) {
    return new Response('Not found', { status: 404 })
  }

  await supabase.from('calendar_feeds').update({ last_accessed_at: new Date().toISOString() }).eq('id', feed.id)

  // Resolve feed filters into events. Filters:
  //   { leagueIds?, competitorIds?, customLeagueId?, reminderMinutes? }
  let query = supabase
    .from('events')
    .select(
      [
        'id, title, starts_at, starts_at_tbd, updated_at, version, status, metadata',
        'venues(name)',
        'sports(key)',
        'leagues(name)',
        feed.include_broadcasts ? 'broadcasts(country, channel, kind, stream_url)' : '',
      ]
        .filter(Boolean)
        .join(', '),
    )
    .neq('status', 'finished')
    .gte('starts_at', new Date(Date.now() - 24 * 3600_000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(500)

  // A "placeholder" is an event whose kickoff time is still TBD.
  if (!feed.include_placeholders) {
    query = query.eq('starts_at_tbd', false)
  }

  const filters = (feed.filters ?? {}) as {
    leagueIds?: string[]
    competitorIds?: string[]
    customLeagueId?: string
    reminderMinutes?: number[]
  }

  if (filters.customLeagueId) {
    query = query.eq('custom_league_id', filters.customLeagueId)
  } else if (filters.leagueIds?.length) {
    query = query.in('league_id', filters.leagueIds)
  }

  let { data: events } = await query
  events = (events ?? []) as EventRow[]

  if (filters.competitorIds?.length) {
    const { data: links } = await supabase
      .from('event_competitors')
      .select('event_id')
      .in('competitor_id', filters.competitorIds)
    const allowed = new Set((links ?? []).map((row) => row.event_id))
    events = (events as EventRow[]).filter((event) => allowed.has(event.id))
  }

  const feedEvents: FeedEvent[] = (events as EventRow[]).map((event) => ({
    id: event.id,
    title: event.title,
    starts_at: event.starts_at,
    starts_at_tbd: event.starts_at_tbd ?? false,
    updated_at: event.updated_at,
    version: event.version,
    status: event.status,
    venue_name: event.venues?.name ?? null,
    sport_key: event.sports?.key ?? null,
    league_name: event.leagues?.name ?? null,
    broadcasts: feed.include_broadcasts ? (event.broadcasts ?? []) : [],
  }))

  return new Response(
    renderCalendar(feed.name, feedEvents, {
      appUrl: APP_URL,
      reminderMinutes: Array.isArray(filters.reminderMinutes) ? filters.reminderMinutes : [],
    }),
    {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        // Calendar clients poll on their own schedule; modest CDN caching takes the edge off.
        'cache-control': 'public, max-age=300',
      },
    },
  )
})
