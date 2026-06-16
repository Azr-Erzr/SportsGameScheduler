import { BellRing } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { getSupabaseClient } from '../lib/supabase'
import {
  defaultAlertPref,
  deleteAlertPreference,
  loadAlertPreferences,
  resolveFollowLabels,
  saveAlertPreference,
  type AlertChannelPref,
  type FollowLabel,
} from '../data/alerts'

const LEAD_OPTIONS = [
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 180, label: '3 hours before' },
  { value: 1440, label: '1 day before' },
]

export function AlertSettingsPage() {
  const { auth, followedLeagueIds, followedCompetitorIds } = useAppState()
  const [labels, setLabels] = useState<FollowLabel[]>([])
  const [prefs, setPrefs] = useState<Record<string, AlertChannelPref>>({})
  const [loadedKey, setLoadedKey] = useState('')
  const [message, setMessage] = useState('')

  const userId = auth.user?.id
  const followKey = useMemo(
    () => [...followedLeagueIds, ...followedCompetitorIds].sort().join(','),
    [followedLeagueIds, followedCompetitorIds],
  )
  const dataKey = userId ? `${userId}|${followKey}` : ''
  const loading = Boolean(userId) && loadedKey !== dataKey

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (cancelled) return
      if (!userId || !supabase) {
        setLabels([])
        setPrefs({})
        setLoadedKey(dataKey)
        return
      }
      const [resolved, existing] = await Promise.all([
        resolveFollowLabels(supabase, followedLeagueIds, followedCompetitorIds),
        loadAlertPreferences(supabase, userId),
      ])
      if (cancelled) return
      setLabels(resolved)
      setPrefs(Object.fromEntries(existing.map((p) => [p.targetId, p])))
      setLoadedKey(dataKey)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey])

  async function persist(pref: AlertChannelPref) {
    setPrefs((current) => ({ ...current, [pref.targetId]: pref }))
    const supabase = await getSupabaseClient()
    if (supabase && userId) await saveAlertPreference(supabase, userId, pref)
    setMessage('Alerts updated.')
  }

  async function disable(label: FollowLabel) {
    setPrefs((current) => {
      const next = { ...current }
      delete next[label.id]
      return next
    })
    const supabase = await getSupabaseClient()
    if (supabase && userId) await deleteAlertPreference(supabase, userId, label.type, label.id)
    setMessage('Alerts turned off for that follow.')
  }

  function toggleEmail(label: FollowLabel, on: boolean) {
    if (on) void persist(defaultAlertPref(label.type, label.id))
    else void disable(label)
  }

  if (!auth.configured) {
    return <EmptyState title="Live data not configured" body="Connect Supabase to manage alerts." />
  }

  if (!auth.user) {
    return (
      <EmptyState
        title="Sign in to manage alerts"
        body="Reminders and schedule-change emails are tied to your account so they work across devices. Sign in, then follow leagues or players to set alerts."
      >
        <Link to="/my-schedule">
          <Button variant="ghost">Back to My Schedule</Button>
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BellRing size={20} className="text-primary" />
        <div>
          <h1 className="text-xl font-extrabold text-primary">Alerts</h1>
          <p className="text-sm text-ink/60">
            Email reminders and schedule-change notices for the leagues and players you follow, sent to{' '}
            {auth.user.email ?? 'your account email'}.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="board-label py-10 text-center text-ink/50">Loading alerts…</p>
      ) : labels.length === 0 ? (
        <EmptyState
          title="No follows to alert on yet"
          body="Follow a league or player from any sport, then come back to set reminders."
        >
          <Link to="/explore">
            <Button variant="ghost">Explore sports</Button>
          </Link>
        </EmptyState>
      ) : (
        <>
          {labels.map((label) => {
            const pref = prefs[label.id]
            const on = Boolean(pref)
            return (
              <Panel key={label.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{label.name}</h3>
                    <Badge tone="muted">{label.type}</Badge>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={on} onChange={(e) => toggleEmail(label, e.target.checked)} />
                    Email reminders
                  </label>
                </div>

                {on && pref && (
                  <div className="grid gap-3 border-t border-primary/10 pt-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-2 text-sm text-ink/75">
                      Remind me
                      <select
                        value={pref.remindMinutesBefore}
                        onChange={(e) => persist({ ...pref, remindMinutesBefore: Number(e.target.value) })}
                        className="rounded-lg border border-primary/20 bg-surface px-2 py-1 text-sm"
                      >
                        {LEAD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        checked={pref.notifyTimeChanges}
                        onChange={(e) => persist({ ...pref, notifyTimeChanges: e.target.checked })}
                      />
                      Notify on time changes
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink/75">
                      <input
                        type="checkbox"
                        checked={pref.notifyCancellations}
                        onChange={(e) => persist({ ...pref, notifyCancellations: e.target.checked })}
                      />
                      Notify on cancellations
                    </label>
                  </div>
                )}
              </Panel>
            )
          })}
          {message && <p className="text-sm font-medium text-primary">{message}</p>}
          <p className="text-xs text-ink/45">
            Web push notifications are coming soon. Until then, alerts are delivered by email.
          </p>
        </>
      )}
    </div>
  )
}
