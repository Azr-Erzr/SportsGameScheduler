import { BellRing, Mail, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { getSupabaseClient } from '../lib/supabase'
import { disableBrowserPush, enableBrowserPush, pushSupported, vapidPublicKey } from '../lib/push'
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
  // Permission priming: explain push before triggering the browser's permission prompt, so a
  // user who isn't ready taps "Not now" instead of "Block" (which is sticky and hard to undo).
  const [pushPriming, setPushPriming] = useState<string | null>(null)

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

  async function togglePush(pref: AlertChannelPref, on: boolean) {
    if (!userId) return
    try {
      if (on) await enableBrowserPush(userId)
      else await disableBrowserPush()
      await persist({ ...pref, pushEnabled: on })
      setMessage(on ? 'Browser push enabled for this device.' : 'Browser push disabled for this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Browser push could not be updated.')
    }
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

      <Panel className="space-y-2 border-primary/15 bg-primary/5 text-sm text-ink/70">
        <p className="font-semibold text-ink/85">How Silbo alerts work</p>
        <ul className="space-y-1.5">
          <li className="flex gap-2">
            <Mail size={14} className="mt-0.5 shrink-0 text-primary" />
            <span><strong className="font-semibold text-ink/85">Email</strong> goes to your account address ({auth.user.email ?? 'your account email'}). Every email has a one-tap link back here to change or stop it.</span>
          </li>
          <li className="flex gap-2">
            <Smartphone size={14} className="mt-0.5 shrink-0 text-primary" />
            <span><strong className="font-semibold text-ink/85">Browser push</strong> is opt-in per device and asks your browser's permission first. Turn it off here or in your browser any time.</span>
          </li>
          <li className="flex gap-2">
            <BellRing size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>We only message you about <strong className="font-semibold text-ink/85">leagues and players you follow</strong> — never marketing. Nothing sends until you switch a follow on below.</span>
          </li>
        </ul>
      </Panel>

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
                      <label className="flex items-center justify-between gap-3 rounded-lg border border-primary/15 bg-page/45 px-3 py-2 text-sm text-ink/75">
                        <span>
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <Smartphone size={14} className="text-primary" /> Browser push
                          </span>
                          <span className="mt-0.5 block text-xs text-ink/50">
                            {pushSupported()
                              ? 'Sends alerts to this browser.'
                              : vapidPublicKey
                                ? 'This browser does not support web push.'
                                : 'Set VITE_VAPID_PUBLIC_KEY plus function VAPID secrets to enable.'}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={pref.pushEnabled}
                          disabled={!pushSupported()}
                          onChange={(e) => {
                            const wantsOn = e.target.checked
                            const needsPermission =
                              typeof Notification !== 'undefined' && Notification.permission !== 'granted'
                            if (wantsOn && needsPermission) setPushPriming(label.id)
                            else void togglePush(pref, wantsOn)
                          }}
                        />
                      </label>
                    </div>

                    {pushPriming === label.id && (
                      <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2.5">
                        <p className="text-sm font-semibold text-ink/85">Enable browser push on this device?</p>
                        <p className="mt-1 text-xs text-ink/55">
                          Your browser will ask for notification permission. You'll get a popup when{' '}
                          <strong className="font-semibold text-ink/75">{label.name}</strong> has a kickoff reminder or
                          schedule change — even when Silbo isn't open. Turn it off here or in your browser any time.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="solid"
                            className="px-3 py-1 text-xs"
                            onClick={() => {
                              setPushPriming(null)
                              void togglePush(pref, true)
                            }}
                          >
                            Allow push
                          </Button>
                          <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setPushPriming(null)}>
                            Not now
                          </Button>
                        </div>
                      </div>
                    )}

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
          <p className="text-xs text-ink/45">
            Changes save instantly to your account and apply across your devices. Alerts fire from the moment a
            followed event's time, venue, lineup, or status changes — Silbo never messages you about anything you
            don't follow.
          </p>
        </>
      )}
    </div>
  )
}
