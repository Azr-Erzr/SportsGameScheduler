import { CalendarDays, Copy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, EmptyState, Panel } from '../components/ui'
import { loadSharedLeague } from '../data/customLeagues'
import { brand } from '../domain/brand'
import { customLeagueSportOptions } from '../domain/sports'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { createCustomLeagueIcsBlob } from '../lib/ics'
import { getSupabaseClient } from '../lib/supabase'
import { formatLongDate, formatTime } from '../lib/time'
import { getCustomLeagueByToken, type CustomLeague } from '../lib/store'
import { SportThemeProvider } from '../theme/SportThemeProvider'
import { paperTheme } from '../theme/themes'

// Public, read-only custom-league schedule (Objective 9). Reached via the unguessable share
// token; requires no login. Resolves locally first (creator's device), then from Supabase via
// the share-gated get_shared_league RPC — so links now work cross-device.

export function SharePage() {
  const { token = '' } = useParams()
  const [league, setLeague] = useState<CustomLeague | undefined>(() => getCustomLeagueByToken(token))
  const [loading, setLoading] = useState(!league)
  const [message, setMessage] = useState('')
  const sportLabels = new Map<string, string>(customLeagueSportOptions.map((sport) => [sport.key, sport.label]))

  useEffect(() => {
    if (league) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }
      const remote = await loadSharedLeague(supabase, token)
      if (cancelled) return
      if (remote) setLeague(remote)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [token, league])

  if (!league) {
    if (loading) {
      return <p className="board-label py-10 text-center text-ink/50">Loading schedule…</p>
    }
    return (
      <EmptyState
        title="Schedule not found"
        body="This share link is invalid, or the schedule's owner has turned sharing off."
      />
    )
  }

  const upcoming = league.events.filter((event) => event.status !== 'cancelled')

  async function exportIcs() {
    downloadBlob(createCustomLeagueIcsBlob(league!), `${league!.name.toLowerCase().replace(/\s+/g, '-')}.ics`)
    setMessage('Calendar file downloaded.')
  }

  async function copyText() {
    const lines = league!.events.map((event) => {
      const starts = new Date(event.startsAt)
      return [
        `- ${event.title}${event.opponent ? ` vs ${event.opponent}` : ''}${event.status !== 'scheduled' ? ` (${event.status.toUpperCase()})` : ''}`,
        `  ${formatLongDate(starts, league!.timezone)} at ${formatTime(starts, league!.timezone)}${event.venue ? ` - ${event.venue}` : ''}`,
        event.arriveEarlyMinutes ? `  Arrive ${event.arriveEarlyMinutes} min early` : '',
        event.uniformColor ? `  Uniform: ${event.uniformColor}` : '',
        league!.includeNotesInShare && event.notes ? `  Notes: ${event.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    await copyToClipboard([`${league!.name} schedule`, `All times ${league!.timezone}`, '', ...lines].join('\n'))
    setMessage('Schedule copied as text.')
  }

  return (
    // Paper surface rule (Channel S): public share pages read as the printed program,
    // not the broadcast control room.
    <SportThemeProvider theme={paperTheme}>
      <div className="mx-auto max-w-2xl space-y-4 rounded-card bg-page p-5 text-ink">
      <div className="text-center">
        <Badge tone="muted" className="mb-2">Shared schedule</Badge>
        <h1 className="text-2xl font-extrabold text-primary">{league.name}</h1>
        <p className="text-sm text-ink/60">
          {sportLabels.get(league.sportKey) ?? league.sportKey}
          {league.location && <> - {league.location}</>} - all times {league.timezone}
        </p>
      </div>

      <div className="flex justify-center gap-2">
        <Button variant="ghost" onClick={exportIcs}>
          <Download size={15} /> Add to calendar
        </Button>
        <Button variant="subtle" onClick={copyText}>
          <Copy size={15} /> Copy as text
        </Button>
      </div>
      {message && <p className="text-center text-sm font-medium text-primary">{message}</p>}

      <div className="space-y-3">
        {upcoming.length === 0 && (
          <EmptyState title="No events scheduled" body="Check back — the organizer hasn't added events yet." />
        )}
        {league.events.map((event) => {
          const starts = new Date(event.startsAt)
          const cancelled = event.status === 'cancelled'
          return (
            <Panel key={event.id} className={`flex items-center gap-4 ${cancelled ? 'opacity-60' : ''}`}>
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary/10 py-2">
                <CalendarDays size={16} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`font-bold ${cancelled ? 'line-through' : ''}`}>
                    {event.title}
                    {event.opponent ? ` vs ${event.opponent}` : ''}
                  </h3>
                  {event.status !== 'scheduled' && <Badge tone="warning">{event.status}</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-ink/60">
                  {formatLongDate(starts, league.timezone)} at {formatTime(starts, league.timezone)}
                </p>
                <p className="text-xs text-ink/50">
                  {event.venue}
                  {event.arriveEarlyMinutes ? <> - arrive {event.arriveEarlyMinutes} min early</> : null}
                  {event.uniformColor && <> - uniform: {event.uniformColor}</>}
                  {league.includeNotesInShare && event.notes && <> - {event.notes}</>}
                </p>
              </div>
            </Panel>
          )
        })}
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
        Powered by {brand.appName}
      </p>
      </div>
    </SportThemeProvider>
  )
}
