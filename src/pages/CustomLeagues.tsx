import { CalendarDays, Plus, Settings, Share2, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Badge, Button, EmptyState, Field, Panel, PanelHeading } from '../components/ui'
import { customLeagueSportOptions } from '../domain/sports'
import {
  deleteCustomLeague,
  getCustomLeagues,
  newId,
  newToken,
  upsertCustomLeague,
  type CustomLeague,
} from '../lib/store'

export function CustomLeaguesPage() {
  const { prefs } = useAppState()
  const [leagues, setLeagues] = useState<CustomLeague[]>(() => getCustomLeagues())
  const [name, setName] = useState('')
  const [sportKey, setSportKey] = useState('soccer')
  const [location, setLocation] = useState('')
  const sportLabels = new Map<string, string>(customLeagueSportOptions.map((sport) => [sport.key, sport.label]))

  function refresh() {
    setLeagues(getCustomLeagues())
  }

  function createLeague(event: FormEvent) {
    event.preventDefault()
    const league: CustomLeague = {
      id: newId(),
      name: name.trim(),
      sportKey,
      timezone: prefs.timezone,
      location: location.trim(),
      publicToken: newToken(),
      shareEnabled: false,
      includeNotesInShare: false,
      teams: [],
      events: [],
      createdAt: new Date().toISOString(),
    }
    upsertCustomLeague(league)
    setName('')
    setLocation('')
    refresh()
  }

  function remove(league: CustomLeague) {
    if (!confirm(`Delete "${league.name}" and its ${league.events.length} events?`)) return
    deleteCustomLeague(league.id)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Community Schedules</h1>
        <p className="text-sm text-ink/60">
          Little league, kids' hockey, pickup soccer, school teams - build the schedule once, then enable
          a public link when it is ready for families.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel className="h-fit">
          <PanelHeading title="Create a league" subtitle={`Times will be entered in ${prefs.timezone}.`} />
          <form onSubmit={createLeague} className="space-y-3">
            <Field label="League name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maple Ridge U10 Hockey" required />
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink/70">Sport</span>
              <select
                value={sportKey}
                onChange={(e) => setSportKey(e.target.value)}
                className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              >
                {customLeagueSportOptions.map((sport) => (
                  <option key={sport.key} value={sport.key}>
                    {sport.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Home location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Maple Ridge Arena" />
            <Button className="w-full" type="submit">
              <Plus size={15} /> Create league
            </Button>
          </form>
        </Panel>

        <div className="space-y-3">
          {leagues.length === 0 && (
            <EmptyState
              title="No custom leagues yet"
              body="Create one, add teams and events, then enable the public link when you are ready."
            />
          )}
          {leagues.map((league) => (
            <Panel key={league.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{league.name}</h3>
                  <Badge tone="muted">{sportLabels.get(league.sportKey) ?? league.sportKey}</Badge>
                  {league.shareEnabled === false ? <Badge tone="warning">Private</Badge> : <Badge tone="secondary">Shared</Badge>}
                </div>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink/50">
                  <CalendarDays size={12} /> {league.events.length} events - {league.teams.length} teams
                  {league.location && <> - {league.location}</>}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Link to={league.shareEnabled === false ? `/custom-leagues/${league.id}/admin` : `/s/${league.publicToken}`}>
                  <Button variant="subtle" title={league.shareEnabled === false ? 'Enable sharing in admin' : 'Open public share page'}>
                    <Share2 size={14} /> {league.shareEnabled === false ? 'Sharing settings' : 'Share page'}
                  </Button>
                </Link>
                <Link to={`/custom-leagues/${league.id}/admin`}>
                  <Button variant="ghost" title="Manage league">
                    <Settings size={14} /> Manage
                  </Button>
                </Link>
                <Button variant="danger" onClick={() => remove(league)} title="Delete league">
                  <Trash2 size={14} />
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  )
}
