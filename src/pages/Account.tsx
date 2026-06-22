import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Download, ListChecks, LogOut, Mail, Trash2, UserCircle } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { getSupabaseClient } from '../lib/supabase'
import { resolveFollowLabels, type FollowLabel } from '../data/alerts'
import { loadRemoteFeeds } from '../data/feeds'
import { localeOptions } from '../lib/i18n'

// Account basics (account plan Phase 5): show who you are, what you've followed, and give a clear
// path to export your data and delete your account (GDPR). Sign-in itself stays in the header
// AuthButton; this page is what a signed-in user manages.

const LOCAL_KEYS = ['mp.follows', 'mp.prefs', 'mp.feeds', 'mp.customLeagues']

export function AccountPage() {
  const { auth, prefs, follows, followedTeams, followedLeagueIds, followedCompetitorIds } = useAppState()
  const navigate = useNavigate()
  const [labels, setLabels] = useState<FollowLabel[]>([])
  const [feedCount, setFeedCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const userId = auth.user?.id
  const customLeagueCount = useMemo(
    () => follows.filter((f) => f.targetType === 'custom_league').length,
    [follows],
  )

  useEffect(() => {
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || !userId || cancelled) return
      const [resolved, feeds] = await Promise.all([
        resolveFollowLabels(supabase, followedLeagueIds, followedCompetitorIds),
        loadRemoteFeeds(supabase, userId),
      ])
      if (cancelled) return
      setLabels(resolved)
      setFeedCount(feeds.length)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, followedLeagueIds.join(','), followedCompetitorIds.join(',')])

  const localeLabel = localeOptions.find((o) => o.code === prefs.locale?.split('-')[0])?.label ?? prefs.locale

  async function handleSignOut() {
    setBusy(true)
    try {
      await auth.signOut()
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      const supabase = await getSupabaseClient()
      if (!supabase) throw new Error('Account services are unavailable in this environment.')
      const { error: fnError } = await supabase.functions.invoke('delete-account', { method: 'POST' })
      if (fnError) throw fnError
      // Clear local mirrors, drop the session, and return home.
      for (const key of LOCAL_KEYS) localStorage.removeItem(key)
      await auth.signOut().catch(() => {})
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account. Please try again.')
      setBusy(false)
    }
  }

  if (!auth.configured) {
    return (
      <EmptyState
        title="Local-only mode"
        body="Account sync isn't available in this environment. Your picks are saved on this device. Configure Supabase to enable accounts."
      />
    )
  }

  if (!auth.ready) {
    return <p className="board-label py-10 text-center text-ink/50" role="status">Loading your account…</p>
  }

  if (!auth.user) {
    return (
      <EmptyState
        title="Sign in to manage your account"
        body="Use the Sign in button at the top to back up your schedule across devices. Your account, alerts, and feeds are managed here once you're signed in."
      >
        <Link to="/exports">
          <Button variant="ghost">
            <Download size={15} /> Export your schedule
          </Button>
        </Link>
      </EmptyState>
    )
  }

  const leagueLabels = labels.filter((l) => l.type === 'league')
  const competitorLabels = labels.filter((l) => l.type === 'competitor')

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <UserCircle size={32} className="text-primary" aria-hidden="true" />
        <div>
          <h1 className="font-display text-2xl tracking-wide text-ink">Your account</h1>
          <p className="text-sm text-ink/55">{auth.user.email}</p>
        </div>
      </header>

      <Panel>
        <PanelHeading title="Profile" subtitle="Your sign-in and display settings." />
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/50">Email</dt>
            <dd className="font-medium text-ink/85">{auth.user.email}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Timezone</dt>
            <dd className="font-medium text-ink/85">{prefs.timezone}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Language</dt>
            <dd className="font-medium text-ink/85">{localeLabel}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Region</dt>
            <dd className="font-medium text-ink/85">{prefs.regionCode}</dd>
          </div>
        </dl>
      </Panel>

      <Panel>
        <PanelHeading title="What you follow" subtitle="Everything synced to this account." />
        <div className="flex flex-wrap gap-2">
          <Badge tone="muted"><ListChecks size={13} /> {followedTeams.length} teams</Badge>
          <Badge tone="muted">{followedLeagueIds.length} leagues</Badge>
          <Badge tone="muted">{followedCompetitorIds.length} players/competitors</Badge>
          <Badge tone="muted">{customLeagueCount} custom leagues</Badge>
          <Badge tone="muted">
            <CalendarClock size={13} /> {feedCount === null ? '…' : feedCount} calendar feeds
          </Badge>
        </div>
        {(leagueLabels.length > 0 || competitorLabels.length > 0) && (
          <div className="mt-4 space-y-2 text-sm">
            {leagueLabels.length > 0 && (
              <p className="text-ink/70">
                <span className="text-ink/45">Leagues: </span>
                {leagueLabels.map((l) => l.name).join(', ')}
              </p>
            )}
            {competitorLabels.length > 0 && (
              <p className="text-ink/70">
                <span className="text-ink/45">Players/competitors: </span>
                {competitorLabels.map((l) => l.name).join(', ')}
              </p>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/my-schedule">
            <Button variant="subtle">My schedule</Button>
          </Link>
          <Link to="/calendar">
            <Button variant="subtle">Calendar feeds</Button>
          </Link>
          <Link to="/settings/alerts">
            <Button variant="subtle">Alerts</Button>
          </Link>
          <Link to="/exports">
            <Button variant="ghost">
              <Download size={15} /> Export my data
            </Button>
          </Link>
        </div>
      </Panel>

      <Panel>
        <PanelHeading title="Session" subtitle="Sign out on this device." />
        <Button variant="ghost" onClick={handleSignOut} disabled={busy}>
          <LogOut size={15} /> Sign out
        </Button>
      </Panel>

      <Panel className="border-flap-chg/40">
        <PanelHeading title="Delete account" subtitle="Permanently remove your account and all associated data." />
        <p className="mb-3 flex items-start gap-2 text-sm text-ink/65">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-flap-chg" aria-hidden="true" />
          This deletes your profile, follows, calendar feeds, alert preferences, and custom leagues. It can&apos;t be undone.
          Consider <Link to="/exports" className="text-primary underline">exporting your schedule</Link> first.
        </p>
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
            <Trash2 size={15} /> Delete my account
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-flap-chg/30 bg-flap-chg/5 p-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink/75">
                Type <span className="font-mono text-flap-chg">DELETE</span> to confirm
              </span>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-lg border border-flap-chg/30 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-flap-chg/40"
                placeholder="DELETE"
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={busy || confirmText.trim().toUpperCase() !== 'DELETE'}
              >
                <Trash2 size={15} /> {busy ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setConfirming(false)
                  setConfirmText('')
                  setError('')
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
            {error && (
              <p className="flex items-center gap-1 text-sm font-medium text-flap-chg">
                <Mail size={14} /> {error}
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
