import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { useAppState } from '../app/state-context'
import { getSupabaseClient } from '../lib/supabase'
import {
  deleteCustomLeague as deleteLocalLeague,
  getCustomLeagues,
  saveCustomLeagues,
  upsertCustomLeague as upsertLocalLeague,
  type CustomEvent,
  type CustomLeague,
  type CustomTeam,
} from '../lib/store'

// Server-backed custom leagues. When signed in, leagues live in Supabase (custom_leagues, with
// teams + events in a JSONB payload) so they sync across devices and share links resolve from the
// server. Offline / signed-out, store.ts (localStorage) remains the source of truth. On sign-in,
// local leagues are merged up. Mirrors the follows pattern in src/data/userData.ts.

type LeagueRow = {
  id: string
  name: string
  timezone: string
  location: string | null
  public_token: string
  share_enabled: boolean
  include_notes_in_share: boolean
  created_at: string
  payload: { sportKey?: string; teams?: CustomTeam[]; events?: CustomEvent[] } | null
}

function rowToLeague(row: LeagueRow): CustomLeague {
  const payload = row.payload ?? {}
  return {
    id: row.id,
    name: row.name,
    sportKey: payload.sportKey ?? 'custom',
    timezone: row.timezone,
    location: row.location ?? '',
    publicToken: row.public_token,
    shareEnabled: row.share_enabled,
    includeNotesInShare: row.include_notes_in_share,
    teams: payload.teams ?? [],
    events: payload.events ?? [],
    createdAt: row.created_at,
  }
}

function leagueToRow(userId: string, league: CustomLeague) {
  return {
    id: league.id,
    owner_user_id: userId,
    name: league.name,
    timezone: league.timezone,
    location: league.location || null,
    public_token: league.publicToken,
    share_enabled: league.shareEnabled,
    include_notes_in_share: league.includeNotesInShare,
    payload: { sportKey: league.sportKey, teams: league.teams, events: league.events, createdAt: league.createdAt },
  }
}

export async function loadRemoteLeagues(supabase: SupabaseClient, userId: string): Promise<CustomLeague[]> {
  const { data } = await supabase
    .from('custom_leagues')
    .select('id, name, timezone, location, public_token, share_enabled, include_notes_in_share, created_at, payload')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as LeagueRow[]).map(rowToLeague)
}

export async function upsertRemoteLeague(supabase: SupabaseClient, userId: string, league: CustomLeague): Promise<void> {
  await supabase.from('custom_leagues').upsert(leagueToRow(userId, league), { onConflict: 'id' })
}

export async function deleteRemoteLeague(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('custom_leagues').delete().eq('id', id)
}

// Public share resolver (gated on share_enabled, server-side). Works without login.
export async function loadSharedLeague(supabase: SupabaseClient, token: string): Promise<CustomLeague | null> {
  const { data } = await supabase.rpc('get_shared_league', { share_token: token })
  const row = (data ?? [])[0] as
    | { id: string; name: string; timezone: string; location: string | null; sport_key: string; include_notes_in_share: boolean; payload: LeagueRow['payload'] }
    | undefined
  if (!row) return null
  const payload = row.payload ?? {}
  return {
    id: row.id,
    name: row.name,
    sportKey: row.sport_key ?? 'custom',
    timezone: row.timezone,
    location: row.location ?? '',
    publicToken: token,
    shareEnabled: true,
    includeNotesInShare: row.include_notes_in_share,
    teams: payload.teams ?? [],
    events: payload.events ?? [],
    createdAt: '',
  }
}

// Hook: the local list is the immediate source; when signed in it merges with the account on
// mount and every mutation write-throughs to Supabase. Keeps the pages synchronous + simple.
export function useCustomLeagues() {
  const { auth } = useAppState()
  const userId = auth.user?.id
  const [leagues, setLeagues] = useState<CustomLeague[]>(() => getCustomLeagues())

  useEffect(() => {
    // Signed out: the local list (initialized from localStorage) stands as-is.
    if (!userId) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      const merged = await mergeLeaguesOnSignIn(supabase, userId, getCustomLeagues())
      if (cancelled) return
      saveCustomLeagues(merged)
      setLeagues(merged)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const save = useCallback(
    (league: CustomLeague) => {
      upsertLocalLeague(league)
      setLeagues(getCustomLeagues())
      if (userId) getSupabaseClient().then((supabase) => supabase && upsertRemoteLeague(supabase, userId, league))
    },
    [userId],
  )

  const remove = useCallback(
    (id: string) => {
      deleteLocalLeague(id)
      setLeagues(getCustomLeagues())
      if (userId) getSupabaseClient().then((supabase) => supabase && deleteRemoteLeague(supabase, id))
    },
    [userId],
  )

  return { leagues, save, remove, signedIn: Boolean(userId) }
}

// On sign-in: push any local leagues not yet on the account, then return the unified set.
export async function mergeLeaguesOnSignIn(
  supabase: SupabaseClient,
  userId: string,
  localLeagues: CustomLeague[],
): Promise<CustomLeague[]> {
  const remote = await loadRemoteLeagues(supabase, userId)
  const remoteIds = new Set(remote.map((l) => l.id))
  const localOnly = localLeagues.filter((l) => !remoteIds.has(l.id))
  if (localOnly.length) {
    await supabase
      .from('custom_leagues')
      .upsert(localOnly.map((l) => leagueToRow(userId, l)), { onConflict: 'id' })
  }
  return [...localOnly, ...remote]
}
