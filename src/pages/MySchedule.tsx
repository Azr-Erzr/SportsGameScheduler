import {
  BellRing,
  CalendarCheck,
  CalendarDays,
  Copy,
  Download,
  FileImage,
  Globe2,
  ListFilter,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { AdSlot } from '../components/AdSlot'
import { CityPicker } from '../components/CityPicker'
import { MatchCard } from '../components/MatchCard'
import { Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { useMyEvents } from '../data/liveSport'
import { allMatches, groupMatches } from '../data/worldcup'
import type { Match } from '../domain/match'
import { brand, exportFilename } from '../domain/brand'
import { interleaveAds } from '../lib/ads'
import { cityLabelFor } from '../lib/cities'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { findConflicts } from '../lib/conflicts'
import { createIcsBlob, createMultiSportIcsBlob, sportEmoji } from '../lib/ics'
import { t } from '../lib/i18n'
import { createNotesText } from '../lib/notes'
import { MAX_EVENTS_BY_TEMPLATE, paginateEvents, type ExportTemplate } from '../lib/paginate'
import { canvasToBlob, createScheduleCanvas } from '../lib/poster'
import { displayTimeOptions, formatLongDate, formatTime } from '../lib/time'
import { useNow } from '../lib/useNow'
import { posterChromeTheme } from '../theme/themes'
import { CalendarFeedsPage } from './CalendarFeeds'

type RangeKey = 'all' | 'today' | 'weekend' | 'week'
type ScheduleSection = 'calendar' | 'downloads' | 'reminders' | 'settings'

const ranges: Array<{ key: RangeKey; labelKey: string }> = [
  { key: 'all', labelKey: 'schedule.range.all' },
  { key: 'today', labelKey: 'schedule.range.today' },
  { key: 'weekend', labelKey: 'schedule.range.weekend' },
  { key: 'week', labelKey: 'schedule.range.week' },
]

const templates: Array<{ key: ExportTemplate; labelKey: string; hint: string }> = [
  { key: 'story', labelKey: 'export.template.story', hint: '7 events/page' },
  { key: 'poster', labelKey: 'export.template.poster', hint: '9 events/page' },
  { key: 'compact', labelKey: 'export.template.compact', hint: '12 events/page' },
  { key: 'family', labelKey: 'export.template.family', hint: '6 events/page' },
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
  const day = now.getDay()
  const daysUntilSaturday = day === 0 ? -1 : 6 - day
  const saturday = new Date(startOfDay.getTime() + daysUntilSaturday * 24 * 3600_000)
  const monday = new Date(saturday.getTime() + 2 * 24 * 3600_000)
  return date >= saturday && date < monday
}

function dateRangeLabel(dates: Date[], timeZone: string, locale?: string | null, hour12?: boolean | null) {
  if (dates.length === 0) return 'No scheduled dates yet'
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const options = displayTimeOptions(locale, hour12)
  if (first.toDateString() === last.toDateString()) return formatLongDate(first, timeZone, options)
  return `${formatLongDate(first, timeZone, options)} - ${formatLongDate(last, timeZone, options)}`
}

function groupByLocalDate(matches: Match[], timeZone: string, locale?: string | null, hour12?: boolean | null) {
  const groups = new Map<string, { key: string; label: string; matches: Match[] }>()
  const options = displayTimeOptions(locale, hour12)

  matches.forEach((match) => {
    const label = formatLongDate(match.startsAt, timeZone, options)
    const key = `${match.startsAt.toISOString().slice(0, 10)}-${label}`
    const group = groups.get(key) ?? { key, label, matches: [] }
    group.matches.push(match)
    groups.set(key, group)
  })

  return Array.from(groups.values())
}

export function MySchedulePage() {
  const { followedTeams, followedLeagueIds, followedCompetitorIds, toggleFollow, prefs } = useAppState()
  const [range, setRange] = useState<RangeKey>('all')
  const [hidePast, setHidePast] = useState(true)
  const [activeSection, setActiveSection] = useState<ScheduleSection>('calendar')
  const [template, setTemplate] = useState<ExportTemplate>('poster')
  const [message, setMessage] = useState('')

  const timeZone = prefs.timezone
  const cityLabel = cityLabelFor(prefs.timezone, prefs.city)
  const nowMs = useNow()
  const { matches } = useMatches()
  const myEvents = useMyEvents(followedLeagueIds, followedCompetitorIds)
  const hasLiveFollows = followedLeagueIds.length > 0 || followedCompetitorIds.length > 0

  const schedule = useMemo(() => {
    return filterMatchesForTeams(matches, followedTeams)
      .filter(
        (match) =>
          inRange(match.startsAt, range, nowMs) &&
          (!hidePast || match.startsAt.getTime() > nowMs - 2 * 3600_000),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }, [matches, followedTeams, range, hidePast, nowMs])

  const liveSchedule = useMemo(
    () =>
      myEvents.events
        .filter(
          (event) =>
            event.startsAt &&
            inRange(event.startsAt, range, nowMs) &&
            (!hidePast || event.startsAt.getTime() > nowMs - 2 * 3600_000),
        )
        .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)),
    [myEvents.events, range, hidePast, nowMs],
  )

  const conflicts = useMemo(() => findConflicts(schedule), [schedule])
  const dateGroups = useMemo(
    () => groupByLocalDate(schedule, timeZone, prefs.locale, prefs.hour12),
    [schedule, timeZone, prefs.locale, prefs.hour12],
  )
  const pages = useMemo(() => paginateEvents(schedule, template), [schedule, template])

  const allVisibleDates = useMemo(
    () => [
      ...schedule.map((match) => match.startsAt),
      ...liveSchedule.flatMap((event) => (event.startsAt ? [event.startsAt] : [])),
    ],
    [schedule, liveSchedule],
  )
  const venueCount = useMemo(() => {
    const venues = new Set<string>()
    schedule.forEach((match) => venues.add(match.ground))
    liveSchedule.forEach((event) => {
      if (event.venue) venues.add(event.venue)
    })
    return venues.size
  }, [schedule, liveSchedule])

  const nextWorldCupMatch = schedule[0]
  const totalVisible = schedule.length + liveSchedule.length
  const followCount = followedTeams.length + followedLeagueIds.length + followedCompetitorIds.length
  const tbdSlotCount = allMatches.length - groupMatches.length

  const selectedTeamsSummary =
    followedTeams.length === 0
      ? 'No World Cup teams yet'
      : followedTeams.length <= 4
        ? followedTeams.join(', ')
        : `${followedTeams.slice(0, 4).join(', ')} +${followedTeams.length - 4}`

  const liveStatus = myEvents.loading
    ? 'Checking live sports data...'
    : hasLiveFollows
      ? 'Live follows read from Silbo DB'
      : 'World Cup picks stored on this device'

  const followCounts = useMemo(
    () => followedTeams.map((team) => ({ team, count: filterMatchesForTeams(matches, [team]).length })),
    [matches, followedTeams],
  )

  function exportLiveIcs() {
    downloadBlob(
      createMultiSportIcsBlob(liveSchedule, { reminderMinutes: [60] }),
      exportFilename('live-schedule', 'ics'),
    )
    setMessage('All-sports calendar downloaded with 1-hour reminders.')
  }

  async function exportIcs() {
    downloadBlob(createIcsBlob(schedule, timeZone, prefs.locale, prefs.hour12), exportFilename('schedule', 'ics'))
    setMessage('Calendar snapshot downloaded. Use a subscribed calendar feed for automatic updates.')
  }

  async function exportImages(share: boolean) {
    let pageNumber = 1
    for (const pageEvents of pages) {
      const canvas = createScheduleCanvas(
        pageEvents,
        followedTeams,
        timeZone,
        cityLabel,
        {
          page: pageNumber,
          pageCount: pages.length,
        },
        posterChromeTheme,
        prefs.locale,
        prefs.hour12,
      )
      if (!canvas) continue
      const blob = await canvasToBlob(canvas)
      const filename =
        pages.length > 1 ? `silbo-schedule-${pageNumber}-of-${pages.length}.png` : exportFilename('schedule', 'png')
      const file = new File([blob], filename, { type: 'image/png' })

      if (share && pages.length === 1 && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: brand.scheduleTitle, files: [file] })
        setMessage('Image opened in your share sheet.')
        return
      }
      downloadBlob(blob, filename)
      pageNumber += 1
    }
    setMessage(
      pages.length > 1
        ? `${pages.length} readable pages downloaded - long schedules stay legible.`
        : 'Schedule image downloaded.',
    )
  }

  async function copyNotes() {
    const text = createNotesText(schedule, followedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12)
    await copyToClipboard(text)
    setMessage('Plain-text schedule copied - paste it into Notes or a group chat.')
  }

  async function shareSchedule() {
    const text = createNotesText(schedule, followedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12)
    if (navigator.share) {
      await navigator.share({ title: brand.scheduleTitle, text })
      setMessage('Schedule opened in your share sheet.')
      return
    }
    await copyToClipboard(text)
    setMessage('Schedule copied for sharing.')
  }

  function printSchedule() {
    window.print()
    setMessage('Print dialog opened.')
  }

  if (followedTeams.length === 0 && !hasLiveFollows) {
    return (
      <EmptyState
        title={t('schedule.emptyTitle', undefined, prefs.locale)}
        body={t('schedule.emptyBody', undefined, prefs.locale)}
      >
        <Link to="/sports/soccer">
          <Button>{t('schedule.pickWorldCup', undefined, prefs.locale)}</Button>
        </Link>
        <Link to="/explore">
          <Button variant="ghost">{t('home.exploreSports', undefined, prefs.locale)}</Button>
        </Link>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary">{t('schedule.title', undefined, prefs.locale)}</h1>
          <p className="max-w-3xl text-sm text-ink/60">
            Review your saved games, sync them to your calendar, download static copies, print, share, and manage
            reminders from one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/settings/alerts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-ink/75 hover:bg-primary/8"
          >
            <BellRing size={15} /> Reminders
          </Link>
          <CityPicker />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Saved schedule</p>
          <div className="mt-2 flex items-center gap-2">
            <CalendarDays size={18} className="shrink-0 text-primary" />
            <span className="text-lg font-extrabold">{totalVisible}</span>
            <span className="text-sm text-ink/55">visible events</span>
          </div>
        </Panel>
        <Panel className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Date range</p>
          <p className="mt-2 truncate text-sm font-semibold">
            {dateRangeLabel(allVisibleDates, timeZone, prefs.locale, prefs.hour12)}
          </p>
        </Panel>
        <Panel className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Teams & venues</p>
          <p className="mt-2 truncate text-sm font-semibold">
            {selectedTeamsSummary} / {venueCount} venues
          </p>
        </Panel>
        <Panel className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Sync status</p>
          <p className="mt-2 flex items-center gap-2 truncate text-sm font-semibold">
            <RefreshCw size={15} className="shrink-0 text-primary" /> {liveStatus}
          </p>
        </Panel>
      </div>

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading
            title="Use your schedule"
            subtitle="Choose a live calendar feed for changes, or a static download when you just need a copy."
          />
          {message && <p className="text-sm font-medium text-primary">{message}</p>}
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveSection('calendar')}
            aria-pressed={activeSection === 'calendar'}
            className={`rounded-lg border px-3 py-3 text-left transition-colors ${
              activeSection === 'calendar'
                ? 'border-primary bg-primary text-void'
                : 'border-primary/20 bg-page/60 hover:bg-primary/8'
            }`}
          >
            <CalendarCheck size={18} />
            <span className="mt-2 block text-sm font-bold">Add to calendar</span>
            <span className={`mt-1 block text-xs ${activeSection === 'calendar' ? 'text-void/70' : 'text-ink/55'}`}>
              Subscribe once for updates.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('downloads')}
            aria-pressed={activeSection === 'downloads'}
            className={`rounded-lg border px-3 py-3 text-left transition-colors ${
              activeSection === 'downloads'
                ? 'border-export bg-export text-void'
                : 'border-export/25 bg-page/60 hover:bg-export/8'
            }`}
          >
            <Download size={18} />
            <span className="mt-2 block text-sm font-bold">Download</span>
            <span className={`mt-1 block text-xs ${activeSection === 'downloads' ? 'text-void/70' : 'text-ink/55'}`}>
              Image, .ics, text, print.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('reminders')}
            aria-pressed={activeSection === 'reminders'}
            className={`rounded-lg border px-3 py-3 text-left transition-colors ${
              activeSection === 'reminders'
                ? 'border-primary bg-primary/90 text-void'
                : 'border-primary/20 bg-page/60 hover:bg-primary/8'
            }`}
          >
            <BellRing size={18} />
            <span className="mt-2 block text-sm font-bold">Reminders</span>
            <span className={`mt-1 block text-xs ${activeSection === 'reminders' ? 'text-void/70' : 'text-ink/55'}`}>
              Kickoff and change alerts.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            aria-pressed={activeSection === 'settings'}
            className={`rounded-lg border px-3 py-3 text-left transition-colors ${
              activeSection === 'settings'
                ? 'border-primary bg-primary/90 text-void'
                : 'border-primary/20 bg-page/60 hover:bg-primary/8'
            }`}
          >
            <SlidersHorizontal size={18} />
            <span className="mt-2 block text-sm font-bold">Settings</span>
            <span className={`mt-1 block text-xs ${activeSection === 'settings' ? 'text-void/70' : 'text-ink/55'}`}>
              Timezone and display.
            </span>
          </button>
        </div>

        {activeSection === 'calendar' && <CalendarFeedsPage embedded />}

        {activeSection === 'downloads' && (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="space-y-3">
              <Panel className="bg-page/45">
                <PanelHeading title="Image template" subtitle="Photo exports paginate instead of shrinking text." />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {templates.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTemplate(item.key)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        template === item.key
                          ? 'border-primary bg-primary text-void'
                          : 'border-primary/20 bg-surface hover:bg-primary/5'
                      }`}
                    >
                      {t(item.labelKey, undefined, prefs.locale)}
                      <span
                        className={`block text-xs font-normal ${template === item.key ? 'text-void/70' : 'text-ink/50'}`}
                      >
                        {item.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-ink/70">
                  {schedule.length} World Cup events {'->'} {pages.length} page{pages.length === 1 ? '' : 's'} (max{' '}
                  {MAX_EVENTS_BY_TEMPLATE[template]} per page)
                </p>
              </Panel>
              <Panel className="space-y-2 bg-page/45">
                <PanelHeading title="Static copies" />
                <Button className="w-full" variant="export" onClick={() => exportImages(true)} disabled={schedule.length === 0}>
                  <FileImage size={15} /> {pages.length > 1 ? `Save images (${pages.length})` : 'Save image'}
                </Button>
                <Button className="w-full" variant="ghost" onClick={exportIcs} disabled={schedule.length === 0}>
                  <Download size={15} /> Download World Cup .ics
                </Button>
                <Button className="w-full" variant="ghost" onClick={exportLiveIcs} disabled={liveSchedule.length === 0}>
                  <CalendarDays size={15} /> Download all-sports .ics
                  {liveSchedule.length ? ` (${liveSchedule.length})` : ''}
                </Button>
                <Button className="w-full" variant="subtle" onClick={copyNotes} disabled={schedule.length === 0}>
                  <Copy size={15} /> Copy for Notes
                </Button>
                <Button className="w-full" variant="subtle" onClick={shareSchedule} disabled={schedule.length === 0}>
                  <Share2 size={15} /> Share schedule
                </Button>
                <Button className="w-full" variant="ghost" onClick={printSchedule} disabled={schedule.length === 0}>
                  <Printer size={15} /> Print
                </Button>
              </Panel>
            </div>
            <Panel className="bg-page/45">
              <PanelHeading title="Download preview" subtitle={`Page 1 of ${pages.length || 1} - ${cityLabel} local time`} />
              {schedule.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink/50">Follow teams to see a download preview.</p>
              ) : (
                <div className="space-y-2">
                  {(pages[0] ?? []).map((match) => (
                    <div
                      key={`${match.date}-${match.team1}-${match.team2}`}
                      className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <span className="font-mono text-xs font-semibold text-primary sm:w-32 sm:shrink-0">
                        {formatLongDate(match.startsAt, timeZone, {
                          locale: prefs.locale,
                          hour12: prefs.hour12 ?? undefined,
                        })}{' '}
                        {formatTime(match.startsAt, timeZone, {
                          locale: prefs.locale,
                          hour12: prefs.hour12 ?? undefined,
                        })}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold">
                        {match.team1} vs {match.team2}
                      </span>
                      <span className="hidden truncate text-xs text-ink/50 sm:block">{match.ground}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {activeSection === 'reminders' && (
          <Panel className="grid gap-3 bg-page/45 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <PanelHeading
                title="Reminders & alerts"
                subtitle="Kickoff reminders, timing changes, TBD confirmations, and quiet-hour controls live here."
              />
              <p className="text-sm text-ink/65">
                Calendar feeds can add a 1-hour VALARM today. Email and push reminders depend on the notification setup
                tracked in the master plan.
              </p>
            </div>
            <Link to="/settings/alerts">
              <Button>
                <BellRing size={15} /> Open reminder settings
              </Button>
            </Link>
          </Panel>
        )}

        {activeSection === 'settings' && (
          <Panel className="grid gap-3 bg-page/45 md:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Timezone</p>
              <p className="mt-1 text-sm font-semibold">{timeZone}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Local city</p>
              <p className="mt-1 text-sm font-semibold">{cityLabel}</p>
            </div>
            <div className="flex items-center md:justify-end">
              <CityPicker />
            </div>
          </Panel>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[270px_1fr]">
        <Panel className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <PanelHeading title="Your picks" subtitle={`${followCount} saved follows`} />
          <div className="mb-1 flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-void">
            <span className="text-sm font-bold">World Cup events</span>
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
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <ListFilter size={16} className="text-primary" />
              {ranges.map((item) => (
                <Button
                  key={item.key}
                  variant={range === item.key ? 'solid' : 'ghost'}
                  onClick={() => setRange(item.key)}
                >
                  {t(item.labelKey, undefined, prefs.locale)}
                </Button>
              ))}
              <label className="ml-1 flex items-center gap-2 text-sm text-ink/70">
                <input type="checkbox" checked={hidePast} onChange={(event) => setHidePast(event.target.checked)} />
                {t('schedule.hideFinished', undefined, prefs.locale)}
              </label>
              <span className="flex-1" />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink/45">
                <Globe2 size={13} /> {cityLabel}
              </span>
            </div>
          </Panel>

          {nextWorldCupMatch && (
            <Panel className="flex flex-wrap items-center gap-3">
              <Zap size={18} className="shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-sm text-ink/70">
                <strong className="text-ink">Next World Cup pick:</strong> {nextWorldCupMatch.team1} vs{' '}
                {nextWorldCupMatch.team2} -{' '}
                {formatLongDate(nextWorldCupMatch.startsAt, timeZone, {
                  locale: prefs.locale,
                  hour12: prefs.hour12 ?? undefined,
                })}{' '}
                {formatTime(nextWorldCupMatch.startsAt, timeZone, {
                  locale: prefs.locale,
                  hour12: prefs.hour12 ?? undefined,
                })}
              </p>
            </Panel>
          )}

          {hasLiveFollows && (
            <Panel className="space-y-3">
              <PanelHeading title="Across all sports" subtitle={`${liveSchedule.length} live DB events in this range`} />
              {myEvents.loading ? (
                <p className="text-sm text-ink/50">{t('schedule.loadingLive', undefined, prefs.locale)}</p>
              ) : liveSchedule.length === 0 ? (
                <p className="text-sm text-ink/50">{t('schedule.noLiveRange', undefined, prefs.locale)}</p>
              ) : (
                <ul className="space-y-1.5">
                  {interleaveAds(liveSchedule.slice(0, 40), (event) => event.id, 8).map((entry) =>
                    entry.kind === 'ad' ? (
                      <li key={entry.key}>
                        <AdSlot format="leaderboard" />
                      </li>
                    ) : (
                      <li key={entry.key} className="flex items-center gap-3 rounded-lg bg-page/60 px-3 py-2">
                        <span className="text-lg leading-none">{sportEmoji(entry.item.sportKey)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.item.title}</span>
                        {entry.item.leagueName && (
                          <span className="hidden shrink-0 font-mono text-[10px] uppercase text-ink/40 sm:block">
                            {entry.item.leagueName}
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-xs text-ink/55">
                          {entry.item.startsAt
                            ? `${formatLongDate(entry.item.startsAt, timeZone, {
                                locale: prefs.locale,
                                hour12: prefs.hour12 ?? undefined,
                              })} ${formatTime(entry.item.startsAt, timeZone, {
                                locale: prefs.locale,
                                hour12: prefs.hour12 ?? undefined,
                              })}`
                            : 'TBD'}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </Panel>
          )}

          <Panel className="space-y-4">
            <PanelHeading title="World Cup schedule" subtitle={`${schedule.length} saved matches in this range`} />
            {dateGroups.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-extrabold text-primary">{group.label}</h2>
                  <span className="h-px flex-1 bg-primary/15" />
                  <span className="font-mono text-[10px] uppercase text-ink/40">{group.matches.length} matches</span>
                </div>
                {group.matches.map((match) => {
                  const index = schedule.indexOf(match)
                  return (
                    <MatchCard
                      key={`${match.date}-${match.team1}-${match.team2}`}
                      match={match}
                      timeZone={timeZone}
                      conflicted={conflicts.has(index)}
                      highlightTeams={followedTeams}
                      locale={prefs.locale}
                      hour12={prefs.hour12}
                    />
                  )
                })}
              </section>
            ))}
            {schedule.length === 0 && (
              <EmptyState
                title={t('schedule.noRangeTitle', undefined, prefs.locale)}
                body={t('schedule.noRangeBody', undefined, prefs.locale)}
              />
            )}
          </Panel>

          <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-flap-tbd/50 bg-flap-tbd/8 px-4 py-3">
            <span className="flap flap-tbd shrink-0">{t('schedule.tbdDates', undefined, prefs.locale)}</span>
            <p className="min-w-0 flex-1 text-sm text-ink/70">
              {t('schedule.tbdBody', { count: tbdSlotCount }, prefs.locale)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
