import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { getSupabaseClient } from '../lib/supabase'
import { relativeTimeFromNow } from '../lib/time'

type Overview = {
  generated_at: string
  totals: Record<string, number>
  sports: Array<{ sport: string; leagues: number; events: number; upcoming: number }>
  targets: { active: number; inactive: number; errored: number; stale?: number }
  provider_targets?: Array<{
    provider_key: string
    active: number
    errored: number
    stale: number
    last_checked_at: string | null
    last_error: string | null
  }>
  source_targets?: {
    total: number
    active: number
    dry_run: number
    errored: number
    recent: Array<{
      target_key: string
      sport_key: string
      dry_run: boolean
      last_status: string | null
      last_checked_at: string | null
      last_error: string | null
    }>
  }
  watch?: { providers: number; active_links: number; pending_affiliates: number; approved_affiliates: number }
  secrets?: Record<string, boolean>
  recent_runs: Array<{
    provider_key?: string
    sport_key?: string
    status: string
    fetched: number | null
    changed: number | null
    finished_at: string | null
    error: string | null
  }>
}

export function AdminPage() {
  const { auth } = useAppState()
  const [data, setData] = useState<Overview | null>(null)
  const [status, setStatus] = useState<'idle' | 'forbidden' | 'error'>('idle')

  useEffect(() => {
    if (!auth.user) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      const { data: result, error } = await supabase.functions.invoke('admin-stats', { method: 'POST' })
      if (cancelled) return
      if (error) {
        setStatus('forbidden')
        return
      }
      setData(result as Overview)
    })
    return () => {
      cancelled = true
    }
  }, [auth.user])

  if (!auth.configured) return <EmptyState title="Admin stats unavailable" body="Connect the live backend to view admin stats." />
  if (auth.ready && !auth.user) {
    return (
      <EmptyState title="Admins only" body="Sign in with an admin account to view the observability dashboard.">
        <Link to="/"><Button variant="ghost">Back home</Button></Link>
      </EmptyState>
    )
  }
  if (status === 'forbidden') {
    return (
      <EmptyState
        title="Not authorized"
        body="Your account isn't on the admin allowlist. Add your email to the ADMIN_EMAILS secret to enable access."
      >
        <Link to="/"><Button variant="ghost">Back home</Button></Link>
      </EmptyState>
    )
  }
  if (!data) return <p className="board-label py-10 text-center text-ink/50">Loading admin stats...</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Admin Observability</h1>
        <p className="text-sm text-ink/55">Snapshot generated {relativeTimeFromNow(new Date(data.generated_at))}.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(data.totals).map(([k, v]) => (
          <Panel key={k} className="text-center">
            <p className="text-2xl font-black text-primary">{v.toLocaleString()}</p>
            <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">{k.replace(/_/g, ' ')}</p>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHeading
          title="Hydration targets"
          subtitle={`${data.targets.active} active - ${data.targets.inactive} inactive - ${data.targets.errored} errored - ${data.targets.stale ?? 0} stale`}
        />
        {data.provider_targets?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-ink/45">
                  <th className="py-1">Provider</th>
                  <th className="py-1 text-right">Active</th>
                  <th className="py-1 text-right">Stale</th>
                  <th className="py-1 text-right">Errored</th>
                  <th className="py-1 text-right">Last check</th>
                </tr>
              </thead>
              <tbody>
                {data.provider_targets.map((target) => (
                  <tr key={target.provider_key} className="border-t border-primary/10">
                    <td className="py-1 font-semibold">{target.provider_key}</td>
                    <td className="py-1 text-right">{target.active}</td>
                    <td className="py-1 text-right">{target.stale}</td>
                    <td className="py-1 text-right">{target.errored}</td>
                    <td className="py-1 text-right font-mono text-[10px] text-ink/45">
                      {target.last_checked_at ? relativeTimeFromNow(new Date(target.last_checked_at)) : 'never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel>
          <PanelHeading
            title="Source targets"
            subtitle={
              data.source_targets
                ? `${data.source_targets.active}/${data.source_targets.total} active - ${data.source_targets.dry_run} dry-run - ${data.source_targets.errored} errored`
                : 'Not reported'
            }
          />
          <ul className="mt-3 space-y-1 text-xs text-ink/60">
            {(data.source_targets?.recent ?? []).slice(0, 4).map((target) => (
              <li key={target.target_key} className="flex items-center gap-2">
                <Badge tone={target.last_error ? 'warning' : target.dry_run ? 'muted' : 'secondary'}>
                  {target.dry_run ? 'dry-run' : 'live'}
                </Badge>
                <span className="min-w-0 flex-1 truncate">{target.target_key}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeading
            title="Watch links"
            subtitle={
              data.watch
                ? `${data.watch.active_links} links - ${data.watch.providers} providers`
                : 'Not reported'
            }
          />
          {data.watch && (
            <p className="mt-3 text-sm text-ink/60">
              {data.watch.pending_affiliates} pending affiliate approvals, {data.watch.approved_affiliates} approved.
            </p>
          )}
        </Panel>
        <Panel>
          <PanelHeading title="Secrets" subtitle="Function readiness" />
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(data.secrets ?? {}).map(([key, ready]) => (
              <Badge key={key} tone={ready ? 'secondary' : 'warning'}>
                {key}: {ready ? 'ready' : 'missing'}
              </Badge>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeading title="Coverage by sport" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-ink/45">
                <th className="py-1">Sport</th>
                <th className="py-1 text-right">Leagues</th>
                <th className="py-1 text-right">Events</th>
                <th className="py-1 text-right">Upcoming</th>
              </tr>
            </thead>
            <tbody>
              {data.sports.map((s) => (
                <tr key={s.sport} className="border-t border-primary/10">
                  <td className="py-1 font-semibold">{s.sport}</td>
                  <td className="py-1 text-right">{s.leagues}</td>
                  <td className="py-1 text-right">{s.events.toLocaleString()}</td>
                  <td className="py-1 text-right">{s.upcoming.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeading title="Recent sync runs" />
        <ul className="space-y-1 text-sm">
          {data.recent_runs.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <Badge tone={r.status === 'success' ? 'secondary' : r.status === 'running' ? 'muted' : 'warning'}>{r.status}</Badge>
              {r.provider_key && <span className="font-mono text-[10px] uppercase text-ink/45">{r.provider_key}</span>}
              <span className="text-ink/60">
                {r.fetched ?? 0} fetched - {r.changed ?? 0} changed
              </span>
              <span className="ml-auto font-mono text-[10px] text-ink/45">
                {r.finished_at ? relativeTimeFromNow(new Date(r.finished_at)) : 'in progress'}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
