// Paced player/roster hydrator for INDIVIDUAL sports (tennis, golf, athletics, combat).
//
// For these sports TheSportsDB models the "teams" as grouping entities (tours, weight
// divisions, national federations); the real athletes are each group's roster, fetched via
// lookup_all_players.php?id={groupId}. We store players as competitors(kind='person') linked
// to their group via parent_competitor_id, checkpointed per-group with players_synced_at.
//
// Same guarantees as the event hydrator: key from secret, paced + budgeted, 429-safe,
// idempotent (upsert on provider IDs).

import { createClient } from 'npm:@supabase/supabase-js@2'

const API_KEY = Deno.env.get('THESPORTSDB_API_KEY') ?? ''
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`
const CALL_BUDGET = Number(Deno.env.get('PLAYERS_CALL_BUDGET') ?? 50)
const CALL_SPACING_MS = Number(Deno.env.get('PLAYERS_SPACING_MS') ?? 750)
const ROSTER_TTL_MS = 30 * 24 * 3600_000

const INDIVIDUAL_SPORTS = ['tennis', 'golf', 'athletics', 'combat_sports']

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

class RateLimited extends Error {}
class BudgetSpent extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Player = Record<string, string | null>
type Group = { id: string; provider_competitor_id: string; sport_id: string; league_id: string | null }

Deno.serve(async () => {
  if (!API_KEY) return Response.json({ ok: false, error: 'THESPORTSDB_API_KEY not configured' }, { status: 500 })

  const counters = { calls: 0, groups: 0, players: 0 }
  const staleBefore = new Date(Date.now() - ROSTER_TTL_MS).toISOString()

  const { data: sportRows } = await supabase.from('sports').select('id').in('key', INDIVIDUAL_SPORTS)
  const sportIds = (sportRows ?? []).map((s) => s.id)

  const { data: run } = await supabase
    .from('provider_sync_runs')
    .insert({ provider_key: 'thesportsdb-players', sport_key: 'individual', status: 'running' })
    .select('id')
    .single()

  // Grouping "teams" for individual sports whose roster is unsynced or stale.
  const { data: groups } = await supabase
    .from('competitors')
    .select('id, provider_competitor_id, sport_id, league_id')
    .eq('provider_key', 'thesportsdb')
    .eq('kind', 'team')
    .in('sport_id', sportIds)
    .or(`players_synced_at.is.null,players_synced_at.lt.${staleBefore}`)
    .order('players_synced_at', { ascending: true, nullsFirst: true })
    .limit(CALL_BUDGET)

  let stopped: 'budget' | 'rate_limited' | 'done' = 'done'

  try {
    for (const group of (groups ?? []) as Group[]) {
      if (counters.calls >= CALL_BUDGET) {
        stopped = 'budget'
        break
      }
      try {
        await sleep(CALL_SPACING_MS)
        counters.calls += 1
        const res = await fetch(`${BASE}/lookup_all_players.php?id=${group.provider_competitor_id}`)
        if (res.status === 429) throw new RateLimited()
        if (!res.ok) throw new Error(`lookup_all_players ${group.provider_competitor_id} -> ${res.status}`)
        const json = (await res.json()) as Record<string, unknown>
        // This endpoint returns {player: [...]} (singular key).
        const players = ((json.player ?? json.players) as Player[] | null) ?? []

        if (players.length) {
          const payload = players
            .filter((p) => p.idPlayer && p.strPlayer)
            .map((p) => ({
              sport_id: group.sport_id,
              league_id: group.league_id,
              kind: 'person',
              name: p.strPlayer!,
              short_name: (p.strPlayerAlternate as string) ?? null,
              country: (p.strNationality as string) ?? null,
              logo_url: (p.strCutout as string) ?? (p.strThumb as string) ?? null,
              provider_key: 'thesportsdb',
              provider_competitor_id: p.idPlayer!,
              parent_competitor_id: group.id,
            }))
          for (let i = 0; i < payload.length; i += 200) {
            await supabase
              .from('competitors')
              .upsert(payload.slice(i, i + 200), { onConflict: 'provider_key,provider_competitor_id' })
          }
          counters.players += payload.length
        }
        counters.groups += 1
        await supabase.from('competitors').update({ players_synced_at: new Date().toISOString() }).eq('id', group.id)
      } catch (err) {
        if (err instanceof RateLimited) {
          stopped = 'rate_limited'
          break
        }
        // A single bad group must not abort the batch; mark it synced so we don't loop on it.
        await supabase.from('competitors').update({ players_synced_at: new Date().toISOString() }).eq('id', group.id)
      }
    }
  } catch (error) {
    await supabase
      .from('provider_sync_runs')
      .update({ status: 'failed', error: String(error), changed_count: counters.players, finished_at: new Date().toISOString() })
      .eq('id', run!.id)
    return Response.json({ ok: false, error: String(error), counters }, { status: 500 })
  }

  await supabase
    .from('provider_sync_runs')
    .update({
      status: 'success',
      fetched_count: counters.groups,
      changed_count: counters.players,
      error: stopped === 'done' ? null : `stopped: ${stopped}`,
      finished_at: new Date().toISOString(),
    })
    .eq('id', run!.id)

  return Response.json({ ok: true, stopped, counters })
})
