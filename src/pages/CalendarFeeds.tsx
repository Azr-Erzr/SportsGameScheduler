import { CalendarPlus, Copy, ExternalLink, Power, RefreshCcw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Field, Panel, PanelHeading } from '../components/ui'
import { brand } from '../domain/brand'
import { copyToClipboard } from '../lib/clipboard'
import { getFeeds, newId, newToken, saveFeeds, type CalendarFeed } from '../lib/store'

// Live subscribed calendars (Objective 6). Until the Supabase calendar-feed function is
// deployed, feeds are stored locally and the URL is a placeholder for the deployed shape.
const FEED_BASE_URL = `https://feeds.${brand.domainHint}/calendar`

function feedUrl(feed: CalendarFeed) {
  return `${FEED_BASE_URL}/${feed.token}.ics`
}

function webcalUrl(feed: CalendarFeed) {
  return feedUrl(feed).replace(/^https:\/\//, 'webcal://')
}

export function CalendarFeedsPage() {
  const { followedTeams, prefs } = useAppState()
  const [feeds, setFeeds] = useState<CalendarFeed[]>(() => getFeeds())
  const [name, setName] = useState('My World Cup teams')
  const [includePlaceholders, setIncludePlaceholders] = useState(false)
  const [includeBroadcasts, setIncludeBroadcasts] = useState(false)
  const [message, setMessage] = useState('')

  function persist(next: CalendarFeed[]) {
    saveFeeds(next)
    setFeeds(next)
  }

  function createFeed(event: FormEvent) {
    event.preventDefault()
    const feed: CalendarFeed = {
      id: newId(),
      token: newToken(),
      name: name.trim() || 'My schedule',
      timezone: prefs.timezone,
      filters: { sportKey: 'soccer', teams: followedTeams },
      includePlaceholders,
      includeBroadcasts,
      isActive: true,
      createdAt: new Date().toISOString(),
    }
    persist([...feeds, feed])
    setMessage('Preview feed created locally. Server-backed feeds will show the raw URL once, then store only a token hash.')
  }

  async function copyUrl(feed: CalendarFeed) {
    await copyToClipboard(feedUrl(feed))
    setMessage('Feed URL copied. Paste it into "Subscribe to calendar" in your calendar app.')
  }

  function openWebcal(feed: CalendarFeed) {
    window.location.href = webcalUrl(feed)
    setMessage('Opening your calendar app if this device supports webcal links.')
  }

  function regenerate(feed: CalendarFeed) {
    persist(feeds.map((f) => (f.id === feed.id ? { ...f, token: newToken() } : f)))
    setMessage('Token regenerated. The old URL stops working once the backend feed is live.')
  }

  function toggleActive(feed: CalendarFeed) {
    persist(feeds.map((f) => (f.id === feed.id ? { ...f, isActive: !f.isActive } : f)))
  }

  function remove(feed: CalendarFeed) {
    persist(feeds.filter((f) => f.id !== feed.id))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Silbo Sync</h1>
        <p className="text-sm text-ink/60">
          A <strong>subscribed calendar feed</strong> keeps itself up to date when match times change. A
          one-time <strong>.ics download</strong> is just a snapshot. Prefer feeds for anything ongoing.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="min-w-0 h-fit">
          <PanelHeading
            title="Create a feed"
            subtitle={`Includes your ${followedTeams.length} followed teams, in ${prefs.timezone}.`}
          />
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
            <Button className="w-full" type="submit">
              <CalendarPlus size={15} /> Create feed
            </Button>
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
                  Preview: {feedUrl(feed)}
                </p>
                <p className="text-xs text-ink/50">
                  {feed.filters.teams?.length ?? 0} teams - {feed.timezone}
                  {feed.includePlaceholders ? ' - TBD included' : ''}
                  {feed.includeBroadcasts ? ' - broadcasts included' : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <Button variant="subtle" onClick={() => copyUrl(feed)} title="Copy URL">
                  <Copy size={14} />
                </Button>
                <Button variant="subtle" onClick={() => openWebcal(feed)} title="Open webcal subscribe link">
                  <ExternalLink size={14} />
                </Button>
                <Button variant="ghost" onClick={() => regenerate(feed)} title="Regenerate token">
                  <RefreshCcw size={14} />
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
              read that feed — regenerate the token if a link leaks.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
