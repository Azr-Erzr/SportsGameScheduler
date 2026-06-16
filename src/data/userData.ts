import type { SupabaseClient } from '@supabase/supabase-js'
import type { Follow, Preferences } from '../lib/store'

// Server-side persistence for follows + preferences. The app keeps working fully offline on
// localStorage (see store.ts); when a user signs in, these helpers mirror DB-eligible follows
// into user_follows and preferences into profiles, and merge anything created locally first.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DB_TARGET_TYPES = new Set(['sport', 'league', 'competitor', 'custom_league'])

// Only follows that reference a real DB entity (uuid id) can live in user_follows.target_id.
// World Cup "team" follows use country-name string ids and stay local-only for now.
export function isDbFollow(follow: Follow): boolean {
  return DB_TARGET_TYPES.has(follow.targetType) && UUID_RE.test(follow.targetId)
}

function sameFollow(a: Follow, b: Follow): boolean {
  return a.targetType === b.targetType && a.targetId === b.targetId
}

export async function loadRemoteFollows(supabase: SupabaseClient, userId: string): Promise<Follow[]> {
  const { data } = await supabase
    .from('user_follows')
    .select('target_type, target_id, intent')
    .eq('user_id', userId)
  return (data ?? []).map((row) => ({
    targetType: row.target_type as Follow['targetType'],
    targetId: row.target_id as string,
    intent: (row.intent as Follow['intent']) ?? 'watch',
  }))
}

export async function pushFollow(supabase: SupabaseClient, userId: string, follow: Follow): Promise<void> {
  if (!isDbFollow(follow)) return
  await supabase.from('user_follows').upsert(
    { user_id: userId, target_type: follow.targetType, target_id: follow.targetId, intent: follow.intent },
    { onConflict: 'user_id,target_type,target_id' },
  )
}

export async function removeFollow(supabase: SupabaseClient, userId: string, follow: Follow): Promise<void> {
  if (!isDbFollow(follow)) return
  await supabase
    .from('user_follows')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', follow.targetType)
    .eq('target_id', follow.targetId)
}

// On sign-in: union remote follows with local DB-eligible follows, push the local-only ones up,
// and return the merged set the UI should adopt. Local team (WC) follows are preserved untouched.
export async function mergeFollowsOnSignIn(
  supabase: SupabaseClient,
  userId: string,
  localFollows: Follow[],
): Promise<Follow[]> {
  const remote = await loadRemoteFollows(supabase, userId)
  const localDbEligible = localFollows.filter(isDbFollow)
  const localOnly = localDbEligible.filter((l) => !remote.some((r) => sameFollow(r, l)))
  if (localOnly.length) {
    await supabase.from('user_follows').upsert(
      localOnly.map((f) => ({ user_id: userId, target_type: f.targetType, target_id: f.targetId, intent: f.intent })),
      { onConflict: 'user_id,target_type,target_id' },
    )
  }
  // Keep non-DB (team/WC) local follows, plus the unified DB set (remote ∪ localOnly).
  const localNonDb = localFollows.filter((f) => !isDbFollow(f))
  return [...localNonDb, ...remote, ...localOnly]
}

export async function loadRemotePrefs(supabase: SupabaseClient, userId: string): Promise<Partial<Preferences> | null> {
  const { data } = await supabase
    .from('profiles')
    .select('default_timezone, default_city, locale, hour12')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  const prefs: Partial<Preferences> = {}
  if (data.default_timezone) prefs.timezone = data.default_timezone
  if (data.default_city) prefs.city = data.default_city
  if (data.locale) prefs.locale = data.locale
  if (data.hour12 !== null && data.hour12 !== undefined) prefs.hour12 = data.hour12
  return prefs
}

export async function saveRemotePrefs(supabase: SupabaseClient, userId: string, prefs: Preferences): Promise<void> {
  await supabase.from('profiles').upsert(
    {
      user_id: userId,
      default_timezone: prefs.timezone,
      default_city: prefs.city || null,
      locale: prefs.locale,
      hour12: prefs.hour12,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
}
