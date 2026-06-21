import { BellRing, Mail, Smartphone } from 'lucide-react'
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
import { ALERT_KIND_COPY } from '../../supabase/functions/_shared/alert-copy'

const LEAD_OPTIONS = [
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 180, label: '3 hours before' },
  { value: 1440, label: '1 day before' },
]

const ALERT_OPTIONS: Array<{
  key: keyof Pick<
    AlertChannelPref,
    | 'notifyTimeChanges'
    | 'notifyCancellations'
    | 'notifyNewEvents'
    | 'notifyParticipantUpdates'
    | 'notifyVenueChanges'
    | 'notifyBroadcastUpdates'
  >
  copyKey: keyof typeof ALERT_KIND_COPY
}> = [
  { key: 'notifyTimeChanges', copyKey: 'time_change' },
  { key: 'notifyParticipantUpdates', copyKey: 'participant_update' },
  { key: 'notifyVenueChanges', copyKey: 'venue_change' },
  { key: 'notifyBroadcastUpdates', copyKey: 'broadcast_update' },
  { key: 'notifyNewEvents', copyKey: 'new_event' },
  { key: 'notifyCancellations', copyKey: 'cancellation' },
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
    return <EmptyState title="Alerts unavailable" body="Alert settings will appear here once account sync is connected." />
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
            Choose which schedule changes matter, and where Silbo should send them. Email goes to{' '}
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
                    Alerts on
                  </label>
                </div>

                {on && pref && (
                  <div className="space-y-3 border-t border-primary/10 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/75">
                        <span className="inline-flex items-center gap-2 font-semibold">
                          <Mail size={14} className="text-primary" /> Email
                        </span>
                        <input
                          type="checkbox"
                          checked={pref.emailEnabled}
                          onChange={(e) => persist({ ...pref, emailEnabled: e.target.checked })}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/45">
                        <span>
                          <span className="inline-flex items-center gap-2 font-semibold text-ink/60">
                            <Smartphone size={14} className="text-primary" /> Browser push
                          </span>
                          <span className="mt-0.5 block text-xs">Coming after VAPID keys are provisioned.</span>
                        </span>
                        <input type="checkbox" checked={pref.pushEnabled} disabled />
                      </label>
                    </div>

                    <label className="flex items-center justify-between gap-2 rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/75">
                      <span>
                        <span className="block font-semibold">{ALERT_KIND_COPY.reminder.settingLabel}</span>
                        <span className="text-xs text-ink/50">{ALERT_KIND_COPY.reminder.description}</span>
                      </span>
                      <select
                        value={pref.remindMinutesBefore}
                        onChange={(e) => persist({ ...pref, remindMinutesBefore: Number(e.target.value) })}
                        className="shrink-0 rounded-lg border border-primary/20 bg-surface px-2 py-1 text-sm"
                      >
                        {LEAD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-2 md:grid-cols-2">
                      {ALERT_OPTIONS.map(({ key, copyKey }) => {
                        const copy = ALERT_KIND_COPY[copyKey]
                        return (
                          <label
                            key={key}
                            className="flex items-start gap-3 rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/75"
                          >
                            <input
                              className="mt-1"
                              type="checkbox"
                              checked={Boolean(pref[key])}
                              onChange={(e) => persist({ ...pref, [key]: e.target.checked })}
                            />
                            <span>
                              <span className="block font-semibold">{copy.settingLabel}</span>
                              <span className="text-xs text-ink/50">{copy.description}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Panel>
            )
          })}
          {message && <p className="text-sm font-medium text-primary">{message}</p>}
          <p className="text-xs text-ink/45">Email alerts are live once Resend secrets are set. Browser push is held until VAPID delivery is wired.</p>
        </>
      )}
    </div>
  )
}
