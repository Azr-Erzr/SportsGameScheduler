import { CalendarDays, Copy, Download, FileImage, Globe2, Plus, X, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { CityPicker } from '../components/CityPicker'
import { cityLabelFor } from '../lib/cities'
import { MatchCard } from '../components/MatchCard'
import { Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { allMatches, groupMatches } from '../data/worldcup'
import { exportFilename } from '../domain/brand'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { findConflicts } from '../lib/conflicts'
import { createIcsBlob } from '../lib/ics'
import { createNotesText } from '../lib/notes'
import { canvasToBlob, createScheduleCanvas } from '../lib/poster'
import { formatLongDate, formatTime } from '../lib/time'
import { useNow } from '../lib/useNow'
import { posterChromeTheme } from '../theme/themes'

type RangeKey = 'all' | 'today' | 'weekend' | 'week'

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: 'all', label: 'Tournament' },
  { key: 'today', label: 'Today' },
  { key: 'weekend', label: 'This Weekend' },
  { key: 'week', label: 'Next 7 Days' },
]

function inRange(date: Date, range: RangeKey, nowMs: number): boolean {
  if (range === 'all') return true
  const now = new Date(nowMs)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (range === 'today') {
    const end = new Date(startOfDay.getTime() + 24 * 3600_000)
    return date >= startOfDay && date < end
  }
  if (range === 'week') {
    const end = new Date(startOfDay.getTime() + 7 * 24 * 3600_000)
    return date >= startOfDay && date < end
  }
  // Weekend: upcoming Saturday 00:00 through Sunday 24:00 (or current weekend if today is one).
  const day = now.getDay()
  const daysUntilSaturday = day === 0 ? -1 : 6 - day
  const saturday = new Date(startOfDay.getTime() + daysUntilSaturday * 24 * 3600_000)
  const monday = new Date(saturday.getTime() + 2 * 24 * 3600_000)
  return date >= saturday && date < monday
}

export function MySchedulePage() {
  const { followedTeams, toggleFollow, prefs } = useAppState()
  const [range, setRange] = useState<RangeKey>('all')
  const [hidePast, setHidePast] = useState(true)
  const [exportMessage, setExportMessage] = useState('')

  const timeZone = prefs.timezone
  const cityLabel = cityLabelFor(prefs.timezone, prefs.city)

  // Render-pure clock (quantized external store) so the memo never calls Date.now() in render.
  const nowMs = useNow()
  const { matches } = useMatches()

  const schedule = useMemo(() => {
    return filterMatchesForTeams(matches, followedTeams).filter(
      (match) =>
        inRange(match.startsAt, range, nowMs) &&
        (!hidePast || match.startsAt.getTime() > nowMs - 2 * 3600_000),
    )
  }, [matches, followedTeams, range, hidePast, nowMs])

  const conflicts = useMemo(() => findConflicts(schedule), [schedule])
  const nextMatch = schedule[0]

  // YOUR WORLD rail (adopted from the poster-team entry): every followed pick with its
  // event count, cross-sport once more sports are live.
  const followCounts = useMemo(
    () => followedTeams.map((team) => ({ team, count: filterMatchesForTeams(matches, [team]).length })),
    [matches, followedTeams],
  )

  // Knockout slots exist in the dataset without confirmed teams — surface them as a
  // feature ("we'll whistle when it's set"), not a gap.
  const tbdSlotCount = allMatches.length - groupMatches.length

  async function exportIcs() {
    downloadBlob(createIcsBlob(schedule, timeZone, prefs.locale, prefs.hour12), exportFilename('schedule', 'ics'))
    setExportMessage('Calendar snapshot downloaded. For auto-updating schedules, use Silbo Sync.')
  }

  async function exportImage() {
    const canvas = createScheduleCanvas(
      schedule,
      followedTeams,
      timeZone,
      cityLabel,
      undefined,
      // Locked decision: neon for UI, CHROME for export posters.
      posterChromeTheme,
      prefs.locale,
      prefs.hour12,
    )
    if (!canvas) return
    downloadBlob(await canvasToBlob(canvas), exportFilename('schedule', 'png'))
    setExportMessage('Schedule image downloaded.')
  }

  async function copyNotes() {
    await copyToClipboard(createNotesText(schedule, followedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12))
    setExportMessage('Plain-text schedule copied - paste it into Notes or a group chat.')
  }

  if (followedTeams.length === 0) {
    return (
      <EmptyState
        title="Your schedule is empty"
        body="Follow a few teams and every match they play shows up here, converted to your local time."
      >
        <Link to="/sports/soccer">
          <Button>Pick World Cup teams</Button>
        </Link>
        <Link to="/explore">
          <Button variant="ghost">Explore sports</Button>
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary">My Schedule</h1>
          <p className="text-sm text-ink/60">
            {schedule.length} events for {followedTeams.length} followed teams - shown in {timeZone}
          </p>
        </div>
        <CityPicker />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="flex min-w-0 items-center gap-3">
          <CalendarDays size={18} className="shrink-0 text-primary" />
          <span className="text-sm font-semibold">{schedule.length} upcoming</span>
        </Panel>
        <Panel className="flex min-w-0 items-center gap-3">
          <Globe2 size={18} className="shrink-0 text-primary" />
          <span className="text-sm font-semibold">{cityLabel} local time</span>
        </Panel>
        <Panel className="flex min-w-0 items-center gap-3">
          <Zap size={18} className="shrink-0 text-primary" />
          <span className="min-w-0 truncate text-sm font-semibold">
            {nextMatch
              ? `Next: ${nextMatch.team1} vs ${nextMatch.team2}, ${formatLongDate(nextMatch.startsAt, timeZone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })} ${formatTime(nextMatch.startsAt, timeZone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })}`
              : 'Nothing in this range'}
          </span>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        {/* YOUR WORLD rail: followed picks with event counts. */}
        <Panel className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <PanelHeading title="Your world" subtitle={`${followedTeams.length} picks`} />
          <div className="mb-1 flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-void">
            <span className="text-sm font-bold">All events</span>
            <span className="font-mono text-xs font-bold">{schedule.length}</span>
          </div>
          <ul className="space-y-1">
            {followCounts.map(({ team, count }) => (
              <li
                key={team}
                className="group flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-primary/8"
              >
                <span className="min-w-0 truncate font-semibold">{team}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-ink/55">{count}</span>
                  <button
                    type="button"
                    title={`Unfollow ${team}`}
                    onClick={() => toggleFollow({ targetType: 'team', targetId: team, intent: 'watch' })}
                    className="rounded p-0.5 text-ink/30 opacity-0 transition-opacity hover:text-flap-chg group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <Link
            to="/sports/soccer"
            className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/8"
          >
            <Plus size={14} /> Add a pick
          </Link>
        </Panel>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ranges.map((item) => (
              <Button
                key={item.key}
                variant={range === item.key ? 'solid' : 'ghost'}
                onClick={() => setRange(item.key)}
              >
                {item.label}
              </Button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-sm text-ink/70">
              <input type="checkbox" checked={hidePast} onChange={(e) => setHidePast(e.target.checked)} />
              Hide finished
            </label>
            <span className="flex-1" />
            <Button variant="ghost" onClick={exportIcs}>
              <Download size={15} /> .ics
            </Button>
            <Button variant="export" onClick={exportImage}>
              <FileImage size={15} /> Image
            </Button>
            <Button variant="subtle" onClick={copyNotes}>
              <Copy size={15} /> Notes
            </Button>
          </div>

          {exportMessage && <p className="text-sm font-medium text-primary">{exportMessage}</p>}

            {schedule.map((match, index) => (
              <MatchCard
                key={`${match.date}-${match.team1}-${match.team2}`}
                match={match}
                timeZone={timeZone}
                conflicted={conflicts.has(index)}
                highlightTeams={followedTeams}
                locale={prefs.locale}
                hour12={prefs.hour12}
              />
            ))}
          {schedule.length === 0 && (
            <EmptyState title="No events in this range" body="Try a wider range, or follow more teams." />
          )}

          {/* TBD tracking strip: uncertainty as a feature, departure-board voice. */}
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-flap-tbd/50 bg-flap-tbd/8 px-4 py-3">
            <span className="flap flap-tbd shrink-0">TBD dates</span>
            <p className="min-w-0 flex-1 text-sm text-ink/70">
              Tracking <strong className="text-ink">{tbdSlotCount} knockout slots</strong> without confirmed
              teams. We'll whistle when they're set.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
