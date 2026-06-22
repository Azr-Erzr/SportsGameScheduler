import { CalendarPlus, Copy, ExternalLink, Power, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Field, Panel, PanelHeading } from '../components/ui'
import { copyToClipboard } from '../lib/clipboard'
import { getSupabaseClient } from '../lib/supabase'
import { mergeFeedsOnSignIn, sha256Hex } from '../data/feeds'
import { getFeeds, newId, newToken, saveFeeds, type CalendarFeed } from '../lib/store'

// Live subscribed calendars (Objective 6). When signed in, feeds are persisted to Supabase with a
// hashed token (a DB leak can't reuse the URL) and resolved by the deployed calendar-feed
// function. Signed-out users get a local preview and a nudge to sign in for a live URL.
const FEED_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/calendar-feed`

function feedUrl(feed: CalendarFeed) {
  return `${FEED_ENDPOINT}/${feed.token}.ics`
}

function webcalUrl(feed: CalendarFeed) {
  return feedUrl(feed).replace(/^https?:\/\//, 'webcal://')
}

export function CalendarFeedsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { followedLeagueIds, followedCompetitorIds, prefs, auth } = useAppState()
  const [feeds, setFeeds] = useState<CalendarFeed[]>(() => getFeeds())
  const [name, setName] = useState('My sports schedule')
  const [includePlaceholders, setIncludePlaceholders] = useState(false)
  const [includeBroadcasts, setIncludeBroadcasts] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const signedIn = Boolean(auth.user)
  const followCount = followedLeagueIds.length + followedCompetitorIds.length

  // When signed in, the DB is the source of truth. Claim any feed previewed while signed-out into
  // the account, then show the unified server list. Tokens held locally on this device are
  // re-attached so their URL stays copyable; feeds created on another device list without a URL.
  useEffect(() => {
    if (!auth.user) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      const merged = await mergeFeedsOnSignIn(supabase, auth.user!.id, getFeeds())
      if (!cancelled) setFeeds(merged)
    })
    return () => {
      cancelled = true
    }
  }, [auth.user])

  function persistLocal(next: CalendarFeed[]) {
    saveFeeds(next)
    setFeeds(next)
  }

  async function createFeed(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const token = newToken()
    const filters = {
      leagueIds: followedLeagueIds,
      competitorIds: followedCompetitorIds,
      reminderMinutes: [60],
    }

    try {
      if (signedIn) {
        const supabase = await getSupabaseClient()
        if (!supabase) throw new Error('Supabase not configured')
        const tokenHash = await sha256Hex(token)
        const { data, error } = await supabase
          .from('calendar_feeds')
          .insert({
            user_id: auth.user!.id,
            name: name.trim() || 'My schedule',
            timezone: prefs.timezone,
            filters,
            token_hash: tokenHash,
            include_placeholders: includePlaceholders,
            include_broadcasts: includeBroadcasts,
            is_active: true,
          })
          .select('id, created_at')
          .single()
        if (error) throw error
        const feed: CalendarFeed = {
          id: data.id,
          token, // kept in-memory this session so the live URL is copyable once
          name: name.trim() || 'My schedule',
          timezone: prefs.timezone,
          filters,
          includePlaceholders,
          includeBroadcasts,
          isActive: true,
          createdAt: data.created_at,
        }
        setFeeds((current) => [feed, ...current])
        setMessage('Live feed created. Copy the URL now — for security it is only shown once.')
      } else {
        const feed: CalendarFeed = {
          id: newId(),
          token,
          name: name.trim() || 'My schedule',
          timezone: prefs.timezone,
          filters,
          includePlaceholders,
          includeBroadcasts,
          isActive: true,
          createdAt: new Date().toISOString(),
        }
        persistLocal([feed, ...feeds])
        setMessage('Preview feed created on this device. Sign in to get a live, auto-updating URL.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create feed.')
    } finally {
      setBusy(false)
    }
  }

  async function copyUrl(feed: CalendarFeed) {
    if (!feed.token) {
      setMessage('This feed’s URL was only shown once at creation. Delete and recreate it to get a new URL.')
      return
    }
    await copyToClipboard(feedUrl(feed))
    setMessage('Feed URL copied. Paste it into "Subscribe to calendar" in your calendar app.')
  }

  function openWebcal(feed: CalendarFeed) {
    if (!feed.token) return
    window.location.href = webcalUrl(feed)
    setMessage('Opening your calendar app if this device supports webcal links.')
  }

  async function toggleActive(feed: CalendarFeed) {
    const next = !feed.isActive
    if (signedIn) {
      const supabase = await getSupabaseClient()
      if (supabase) await supabase.from('calendar_feeds').update({ is_active: next }).eq('id', feed.id)
      setFeeds((current) => current.map((f) => (f.id === feed.id ? { ...f, isActive: next } : f)))
    } else {
      persistLocal(feeds.map((f) => (f.id === feed.id ? { ...f, isActive: next } : f)))
    }
  }

  async function remove(feed: CalendarFeed) {
    if (signedIn) {
      const supabase = await getSupabaseClient()
      if (supabase) await supabase.from('calendar_feeds').delete().eq('id', feed.id)
      setFeeds((current) => current.filter((f) => f.id !== feed.id))
    } else {
      persistLocal(feeds.filter((f) => f.id !== feed.id))
    }
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <h1 className="text-xl font-extrabold text-primary">Silbo Sync</h1>
          <p className="text-sm text-ink/60">
            A <strong>subscribed calendar feed</strong> keeps itself up to date when match times change. A
            one-time <strong>.ics download</strong> is just a snapshot. Prefer feeds for anything ongoing.
          </p>
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="min-w-0 h-fit">
          <PanelHeading
            title="Create a feed"
            subtitle={`Includes your ${followCount} followed leagues & players, in ${prefs.timezone}.`}
          />
          {!signedIn && (
            <p className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-ink/70">
              You're not signed in. You can preview a feed here, but a live, auto-updating URL needs an account.
            </p>
          )}
          <form onSubmit={createFeed} className="space-y-3">
            <Field label="Feed name" value={name} onChange={(e) => setName(e.target.value)} required />
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={includePlaceholders}
                onChange={(event) => setIncludePlaceholders(event.target.checked)}
              />
              Include TBD placeholders
            </label>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={includeBroadcasts}
                onChange={(event) => setIncludeBroadcasts(event.target.checked)}
              />
              Include where-to-watch notes when available
            </label>
            <Button className="w-full" type="submit" disabled={busy || followCount === 0}>
              <CalendarPlus size={15} /> {busy ? 'Creating…' : 'Create feed'}
            </Button>
            {followCount === 0 && (
              <p className="text-xs text-ink/50">Follow a league or player first, then create a feed for them.</p>
            )}
          </form>
          <p className="mt-3 text-xs text-ink/50">
            Calendar apps decide their own refresh timing — updates can take a few hours to appear.
          </p>
        </Panel>

        <div className="min-w-0 space-y-3">
          {feeds.length === 0 && (
            <EmptyState
              title="No feeds yet"
              body="Create a feed, then subscribe to its URL from Apple Calendar, Google Calendar, or Outlook. Your schedule stays current automatically."
            />
          )}
          {feeds.map((feed) => (
            <Panel key={feed.id} className="flex min-w-0 flex-col items-stretch gap-3 overflow-hidden sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{feed.name}</h3>
                  {feed.isActive ? <Badge tone="secondary">Active</Badge> : <Badge tone="muted">Disabled</Badge>}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-ink/50">
                  {feed.token ? feedUrl(feed) : 'URL shown once at creation — copy it then'}
                </p>
                <p className="text-xs text-ink/50">
                  {(feed.filters.leagueIds?.length ?? 0) + (feed.filters.competitorIds?.length ?? 0)} picks - {feed.timezone}
                  {feed.includePlaceholders ? ' - TBD included' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <Button variant="subtle" onClick={() => copyUrl(feed)} title="Copy URL" disabled={!feed.token}>
                  <Copy size={14} />
                </Button>
                <Button variant="subtle" onClick={() => openWebcal(feed)} title="Open webcal subscribe link" disabled={!feed.token}>
                  <ExternalLink size={14} />
                </Button>
                <Button variant="ghost" onClick={() => toggleActive(feed)} title={feed.isActive ? 'Disable' : 'Enable'}>
                  <Power size={14} />
                </Button>
                <Button variant="danger" onClick={() => remove(feed)} title="Delete">
                  <Trash2 size={14} />
                </Button>
              </div>
            </Panel>
          ))}
          {message && <p className="text-sm font-medium text-primary">{message}</p>}

          <Panel className="min-w-0 overflow-hidden">
            <PanelHeading title="How to subscribe" />
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/70">
              <li>
                <strong>Apple Calendar:</strong> File → New Calendar Subscription (Mac) or Settings →
                Calendar → Accounts → Add Subscribed Calendar (iPhone), then paste the feed URL.
              </li>
              <li>
                <strong>Google Calendar:</strong> Other calendars → + → From URL, paste the feed URL.
              </li>
              <li>
                <strong>Outlook:</strong> Add calendar → Subscribe from web, paste the feed URL.
              </li>
            </ol>
            <p className="mt-3 text-xs text-ink/50">
              Feed URLs contain an unguessable token, so they work without a login. Anyone with the URL can
              read that feed — delete it if a link leaks.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
