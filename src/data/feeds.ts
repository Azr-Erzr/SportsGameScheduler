import type { SupabaseClient } from '@supabase/supabase-js'
import { getFeeds, type CalendarFeed } from '../lib/store'

// Server-backed calendar feeds. Signed-in feeds live in calendar_feeds (owned by user_id, with
// the token stored only as a SHA-256 hash so a DB leak can't reuse the URL). localStorage keeps the
// raw tokens for THIS device so the live URL stays copyable. On sign-in, feeds the user previewed
// while signed-out are claimed into the account. Mirrors the follows/custom-league sync pattern.

type FeedRow = {
  id: string
  name: string
  timezone: string
  filters: CalendarFeed['filters'] | null
  is_active: boolean
  include_placeholders: boolean
  include_broadcasts: boolean
  created_at: string
  token_hash: string | null
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// Map every locally-held raw token to its hash, so server rows (which only carry the hash) can be
// shown with a copyable URL on the device that created/previewed them.
async function localHashToToken(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  await Promise.all(
    getFeeds()
      .filter((feed) => feed.token)
      .map(async (feed) => {
        map.set(await sha256Hex(feed.token), feed.token)
      }),
  )
  return map
}

function rowToFeed(row: FeedRow, hashToToken: Map<string, string>): CalendarFeed {
  return {
    id: row.id,
    token: (row.token_hash && hashToToken.get(row.token_hash)) || '',
    name: row.name,
    timezone: row.timezone,
    filters: (row.filters ?? {}) as CalendarFeed['filters'],
    includePlaceholders: row.include_placeholders,
    includeBroadcasts: row.include_broadcasts,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export async function loadRemoteFeeds(supabase: SupabaseClient, userId: string): Promise<CalendarFeed[]> {
  const { data } = await supabase
    .from('calendar_feeds')
    .select('id, name, timezone, filters, is_active, include_placeholders, include_broadcasts, created_at, token_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  const hashToToken = await localHashToToken()
  return ((data ?? []) as FeedRow[]).map((row) => rowToFeed(row, hashToToken))
}

// On sign-in: claim any signed-out "preview" feed (a local feed with a token) that the account
// doesn't already own, then return the unified server list with tokens re-attached from the local
// vault. Local tokens are kept (not cleared) so the URL stays copyable on this device.
export async function mergeFeedsOnSignIn(
  supabase: SupabaseClient,
  userId: string,
  localFeeds: CalendarFeed[],
): Promise<CalendarFeed[]> {
  const { data: existing } = await supabase
    .from('calendar_feeds')
    .select('token_hash')
    .eq('user_id', userId)
  const ownedHashes = new Set(((existing ?? []) as { token_hash: string | null }[]).map((r) => r.token_hash))

  const toClaim = await Promise.all(
    localFeeds
      .filter((feed) => feed.token)
      .map(async (feed) => ({ feed, hash: await sha256Hex(feed.token) })),
  )
  const rows = toClaim
    .filter(({ hash }) => !ownedHashes.has(hash))
    .map(({ feed, hash }) => ({
      user_id: userId,
      name: feed.name,
      timezone: feed.timezone,
      filters: feed.filters,
      token_hash: hash,
      include_placeholders: feed.includePlaceholders,
      include_broadcasts: feed.includeBroadcasts,
      is_active: feed.isActive,
    }))

  if (rows.length) await supabase.from('calendar_feeds').insert(rows)

  return loadRemoteFeeds(supabase, userId)
}
