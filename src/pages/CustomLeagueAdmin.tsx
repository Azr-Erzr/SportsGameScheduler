import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Field, Panel, PanelHeading } from '../components/ui'
import { customLeagueSportOptions } from '../domain/sports'
import { loadRemoteLeagues, upsertRemoteLeague } from '../data/customLeagues'
import { copyToClipboard } from '../lib/clipboard'
import { getSupabaseClient } from '../lib/supabase'
import { formatLongDate, formatTime } from '../lib/time'
import {
  getCustomLeagues,
  newId,
  newToken,
  saveCustomLeagues,
  upsertCustomLeague,
  type CustomEvent,
  type CustomLeague,
} from '../lib/store'

export function CustomLeagueAdminPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { auth } = useAppState()
  const userId = auth.user?.id
  const [league, setLeague] = useState<CustomLeague | undefined>(() =>
    getCustomLeagues().find((item) => item.id === leagueId),
  )
  const [teamName, setTeamName] = useState('')
  const [message, setMessage] = useState('')
  const [checkingRemote, setCheckingRemote] = useState(Boolean(userId) && !league)

  // Cross-device: if the league isn't on this device but the user is signed in, pull it from
  // the account.
  useEffect(() => {
    // Only runs the remote lookup when the league is missing locally and the user is signed in;
    // in every other case checkingRemote already initialized to false.
    if (league || !userId || !leagueId) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      const remote = await loadRemoteLeagues(supabase, userId)
      const found = remote.find((l) => l.id === leagueId)
      if (cancelled) return
      if (found) {
        saveCustomLeagues([...getCustomLeagues().filter((l) => l.id !== found.id), found])
        setLeague(found)
      }
      setCheckingRemote(false)
    })
    return () => {
      cancelled = true
    }
  }, [league, userId, leagueId])

  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('18:00')
  const [eventVenue, setEventVenue] = useState('')
  const [eventOpponent, setEventOpponent] = useState('')
  const [eventArrive, setEventArrive] = useState('30')
  const [eventUniform, setEventUniform] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const sportLabels = new Map<string, string>(customLeagueSportOptions.map((sport) => [sport.key, sport.label]))

  if (!league) {
    if (checkingRemote) {
      return <p className="board-label py-10 text-center text-ink/50">Loading league…</p>
    }
    return (
      <EmptyState title="League not found" body="It may have been deleted, or it lives on another device — sign in to sync.">
        <Link to="/custom-leagues">
          <Button variant="ghost">Back to Community</Button>
        </Link>
      </EmptyState>
    )
  }

  function save(next: CustomLeague) {
    upsertCustomLeague(next)
    setLeague(next)
    if (userId) getSupabaseClient().then((supabase) => supabase && upsertRemoteLeague(supabase, userId, next))
  }

  function addTeam(event: FormEvent) {
    event.preventDefault()
    if (!teamName.trim() || !league) return
    save({
      ...league,
      teams: [...league.teams, { id: newId(), name: teamName.trim(), color: '' }],
    })
    setTeamName('')
  }

  function removeTeam(id: string) {
    if (!league) return
    save({ ...league, teams: league.teams.filter((team) => team.id !== id) })
  }

  function addEvent(formEvent: FormEvent) {
    formEvent.preventDefault()
    if (!league || !eventTitle.trim() || !eventDate) return
    const startsAt = new Date(`${eventDate}T${eventTime}:00`)
    const newEvent: CustomEvent = {
      id: newId(),
      title: eventTitle.trim(),
      startsAt: startsAt.toISOString(),
      venue: eventVenue.trim(),
      opponent: eventOpponent.trim() || undefined,
      arriveEarlyMinutes: eventArrive ? Number(eventArrive) : undefined,
      uniformColor: eventUniform.trim() || undefined,
      notes: eventNotes.trim() || undefined,
      status: 'scheduled',
    }
    save({
      ...league,
      events: [...league.events, newEvent].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    })
    setEventTitle('')
    setEventVenue('')
    setEventOpponent('')
    setEventNotes('')
  }

  function setEventStatus(id: string, status: CustomEvent['status']) {
    if (!league) return
    save({
      ...league,
      events: league.events.map((item) => (item.id === id ? { ...item, status } : item)),
    })
  }

  function removeEvent(id: string) {
    if (!league) return
    save({ ...league, events: league.events.filter((item) => item.id !== id) })
  }

  async function copyShareLink() {
    if (league!.shareEnabled === false) {
      setMessage('Sharing is disabled. Enable the public link before copying it.')
      return
    }
    await copyToClipboard(`${window.location.origin}/s/${league!.publicToken}`)
    setMessage('Share link copied. Anyone with it can view the schedule.')
  }

  function toggleShare() {
    if (!league) return
    save({ ...league, shareEnabled: league.shareEnabled === false })
    setMessage(league.shareEnabled === false ? 'Public share link enabled.' : 'Public share link disabled.')
  }

  function rotateShareToken() {
    if (!league) return
    save({ ...league, publicToken: newToken() })
    setMessage('Share link rotated. The old link no longer resolves on this device.')
  }

  function toggleShareNotes() {
    if (!league) return
    save({ ...league, includeNotesInShare: !league.includeNotesInShare })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/custom-leagues')}>
            <ArrowLeft size={15} />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold text-primary">{league.name}</h1>
            <p className="text-sm text-ink/60">
              {sportLabels.get(league.sportKey) ?? league.sportKey} - {league.timezone}
              {league.location && <> - {league.location}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={league.shareEnabled === false ? 'ghost' : 'subtle'} onClick={toggleShare}>
            {league.shareEnabled === false ? 'Enable share' : 'Disable share'}
          </Button>
          <Button variant="ghost" onClick={rotateShareToken}>
            Rotate link
          </Button>
          <Button variant="subtle" onClick={copyShareLink}>
            <Copy size={15} /> Copy share link
          </Button>
        </div>
      </div>
      {message && <p className="text-sm font-medium text-primary">{message}</p>}

      <Panel className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-primary">Share privacy</h2>
          <p className="text-sm text-ink/60">
            Public shares are off by default. Event notes stay private unless you include them.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
          <input type="checkbox" checked={Boolean(league.includeNotesInShare)} onChange={toggleShareNotes} />
          Include notes on public page
        </label>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeading title="Teams" />
            <form onSubmit={addTeam} className="flex gap-2">
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button type="submit">
                <Plus size={15} />
              </Button>
            </form>
            <ul className="mt-3 space-y-1">
              {league.teams.map((team) => (
                <li key={team.id} className="flex items-center justify-between rounded-lg bg-page/70 px-3 py-1.5 text-sm">
                  {team.name}
                  <button
                    type="button"
                    onClick={() => removeTeam(team.id)}
                    className="text-ink/40 hover:text-red-600"
                    title="Remove team"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeading title="Add event" />
            <form onSubmit={addEvent} className="space-y-3">
              <Field label="Title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Practice / vs Eagles" required />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                <Field label="Time" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} required />
              </div>
              <Field label="Venue" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="Rink 2, Maple Ridge Arena" />
              <Field label="Opponent (optional)" value={eventOpponent} onChange={(e) => setEventOpponent(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Arrive early (min)" type="number" value={eventArrive} onChange={(e) => setEventArrive(e.target.value)} />
                <Field label="Uniform" value={eventUniform} onChange={(e) => setEventUniform(e.target.value)} placeholder="White" />
              </div>
              <Field label="Notes" value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Bring water bottles" />
              <Button className="w-full" type="submit">
                <Plus size={15} /> Add event
              </Button>
            </form>
          </Panel>
        </div>

        <div className="space-y-3">
          {league.events.length === 0 && (
            <EmptyState title="No events yet" body="Add practices and games on the left. They appear here and on the public share page." />
          )}
          {league.events.map((item) => {
            const starts = new Date(item.startsAt)
            return (
              <Panel key={item.id} className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`font-bold ${item.status === 'cancelled' ? 'line-through opacity-50' : ''}`}>
                      {item.title}
                      {item.opponent ? ` vs ${item.opponent}` : ''}
                    </h3>
                    {item.status !== 'scheduled' && <Badge tone="warning">{item.status}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {formatLongDate(starts, league.timezone)} at {formatTime(starts, league.timezone)}
                    {item.venue && <> - {item.venue}</>}
                    {item.arriveEarlyMinutes ? <> - arrive {item.arriveEarlyMinutes} min early</> : null}
                    {item.uniformColor && <> - uniform: {item.uniformColor}</>}
                  </p>
                  {item.notes && <p className="mt-0.5 text-xs text-ink/45">{item.notes}</p>}
                </div>
                <div className="flex gap-1.5">
                  <select
                    value={item.status}
                    onChange={(e) => setEventStatus(item.id, e.target.value as CustomEvent['status'])}
                    className="rounded-lg border border-primary/20 bg-surface px-2 py-1.5 text-xs outline-none"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="postponed">Postponed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Button variant="danger" onClick={() => removeEvent(item.id)} title="Delete event">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}
