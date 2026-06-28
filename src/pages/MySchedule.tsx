import {
  BellRing,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  Copy,
  Download,
  FileImage,
  FileSpreadsheet,
  Globe2,
  Info,
  ListFilter,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { AlertOptInNudge } from '../components/AlertOptInNudge'
import { CityPicker } from '../components/CityPicker'
import { Button, EmptyState, Panel, PanelHeading } from '../components/ui'
import { filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { useMyEvents } from '../data/liveSport'
import { allMatches, groupMatches } from '../data/worldcup'
import type { Match } from '../domain/match'
import { getSavedMatchKeys } from '../lib/store'
import { brand, exportFilename } from '../domain/brand'
import { cityLabelFor } from '../lib/cities'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { buildExportAdvice, type ExportAdvice, type ExportAdviceMethod } from '../lib/exportAdvice'
import { createIcsBlob, createMultiSportIcsBlob, sportEmoji } from '../lib/ics'
import { t } from '../lib/i18n'
import { createMultiSportNotesText, createNotesText } from '../lib/notes'
import { MAX_EVENTS_BY_TEMPLATE, paginateEvents, type ExportTemplate } from '../lib/paginate'
import { canvasToJpegPage, createPdfBlobFromImages } from '../lib/pdf'
import { canvasToBlob, createScheduleCanvas, type PosterVariant } from '../lib/poster'
import { createScheduleCsv, exportCompletionMessage } from '../lib/scheduleExports'
import { displayTimeOptions, formatLongDate, formatTime } from '../lib/time'
import { useNow } from '../lib/useNow'
import { CalendarFeedsPage } from './CalendarFeeds'

type RangeKey = 'all' | 'today' | 'weekend' | 'week'
type GuidedFlowId = 'calendar' | 'download' | 'reminders' | 'settings'
type FlowState = { flowId: GuidedFlowId | null; stepIndex: number; answers: Record<string, string> }
type StepOption = { id: string; label: string; description?: string; recommended?: boolean }
type FlowStep = { id: string; question: string; options?: StepOption[]; final?: boolean }
type FlowConfig = { title: string; steps: FlowStep[] }
type ReviewTargetType = 'team' | 'league' | 'competitor'
type ReviewPick = { targetType: ReviewTargetType; targetId: string; label: string; group: string; count: number }
type PreviewItem = {
  id: string
  title: string
  subtitle: string
  startsAt: Date | null
  venue: string
  sportKey: string
  searchable: string
  match?: Match
}

const REVIEW_PAGE_SIZE = 8

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

const guidedFlows: Record<GuidedFlowId, FlowConfig> = {
  calendar: {
    title: 'Add to calendar',
    steps: [
      {
        id: 'calendar_update_mode',
        question: 'How should your calendar stay updated?',
        options: [
          {
            id: 'live_subscription',
            label: 'Keep it updated automatically',
            description: 'Best if match details, TBD teams, or times may change.',
            recommended: true,
          },
          {
            id: 'one_time_import',
            label: 'Add these matches once',
            description: 'Creates calendar events now, but future changes may not update.',
          },
        ],
      },
      {
        id: 'calendar_scope',
        question: 'What should be included?',
        options: [
          { id: 'all_saved', label: 'All saved matches', description: 'Everything you follow in My Schedule.', recommended: true },
          { id: 'visible_matches', label: 'Visible matches', description: 'Only the schedule currently shown on this page.' },
          { id: 'full_tournament', label: 'Full World Cup', description: 'Every available World Cup match.' },
        ],
      },
      {
        id: 'calendar_provider',
        question: 'Which calendar do you use?',
        options: [
          { id: 'google', label: 'Google Calendar' },
          { id: 'apple', label: 'Apple Calendar' },
          { id: 'outlook', label: 'Outlook' },
          { id: 'other', label: 'Other calendar app' },
        ],
      },
      { id: 'calendar_confirm', question: 'Ready to add your schedule', final: true },
    ],
  },
  download: {
    title: 'Download',
    steps: [
      {
        id: 'download_intent',
        question: 'What do you need this for?',
        options: [
          {
            id: 'calendar_import',
            label: 'Track it in a calendar',
            description: 'Best format: ICS. Adds the schedule to your calendar app.',
            recommended: true,
          },
          { id: 'edit_spreadsheet', label: 'Edit in a spreadsheet', description: 'Recommended format: CSV.' },
          { id: 'print_or_save', label: 'Download a polished PDF', description: 'Branded pages ready to save, print, or send.' },
          { id: 'share_copy', label: 'Send to someone', description: 'Use text first; image export is available as a backup.' },
        ],
      },
      {
        id: 'download_scope',
        question: 'What should it include?',
        options: [
          { id: 'all_saved', label: 'All saved matches', recommended: true },
          { id: 'visible_matches', label: 'Visible matches' },
          { id: 'full_tournament', label: 'Full World Cup' },
        ],
      },
      { id: 'download_confirm', question: 'Ready to download', final: true },
    ],
  },
  reminders: {
    title: 'Reminders',
    steps: [
      {
        id: 'reminder_scope',
        question: 'What should we remind you about?',
        options: [
          { id: 'all_saved', label: 'All saved matches', recommended: true },
          { id: 'visible_matches', label: 'Visible matches' },
          { id: 'world_cup_only', label: 'World Cup picks only' },
        ],
      },
      {
        id: 'reminder_timing',
        question: 'When should reminders arrive?',
        options: [
          { id: '15_minutes', label: '15 minutes before' },
          { id: '1_hour', label: '1 hour before', recommended: true },
          { id: '1_day', label: '1 day before' },
        ],
      },
      { id: 'reminder_confirm', question: 'Ready to turn on reminders', final: true },
    ],
  },
  settings: {
    title: 'Schedule settings',
    steps: [{ id: 'settings_confirm', question: 'Tune how your schedule displays', final: true }],
  },
}

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

function optionLabel(step: FlowStep | undefined, answer: string | undefined, fallback: string) {
  return step?.options?.find((option) => option.id === answer)?.label ?? fallback
}

function adviceToneClasses(tone: ExportAdvice['tone']) {
  if (tone === 'warn') return 'border-yellow-500/60 bg-yellow-400/12 text-ink'
  if (tone === 'good') return 'border-primary/35 bg-primary/10 text-ink'
  return 'border-sky-300/45 bg-sky-300/10 text-ink'
}

function reviewKey(target: Pick<ReviewPick, 'targetType' | 'targetId'>) {
  return `${target.targetType}:${target.targetId}`
}

function compactPageCount(total: number) {
  return Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE))
}

function CompactScheduleRow({
  item,
  timeZone,
  locale,
  hour12,
}: {
  item: PreviewItem
  timeZone: string
  locale?: string
  hour12?: boolean | null
}) {
  const timeOptions = displayTimeOptions(locale, hour12)
  return (
    <li className="grid grid-cols-[56px_1fr] gap-3 rounded-lg border border-primary/12 bg-page/55 px-3 py-2 sm:grid-cols-[76px_1fr_auto]">
      <div className="text-center font-mono uppercase">
        <p className="text-[10px] font-bold text-primary">
          {item.startsAt ? formatTime(item.startsAt, timeZone, timeOptions) : 'TBD'}
        </p>
        <p className="mt-0.5 text-[9px] tracking-wide text-ink/40">
          {item.startsAt ? formatLongDate(item.startsAt, timeZone, timeOptions).split(',')[0] : 'Date'}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-ink">{item.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink/50">{item.subtitle}</p>
      </div>
      <div className="hidden min-w-[92px] text-right text-xs text-ink/45 sm:block">
        <span className="font-mono">{sportEmoji(item.sportKey)}</span>
        {item.venue && <p className="truncate">{item.venue}</p>}
      </div>
    </li>
  )
}

export function MySchedulePage() {
  const { followedTeams, followedLeagueIds, followedCompetitorIds, prefs } = useAppState()
  const [range, setRange] = useState<RangeKey>('all')
  const [hidePast, setHidePast] = useState(true)
  // Individually-saved matches (read once on mount; "Add to schedule" elsewhere persists them).
  const [savedMatchKeys] = useState<string[]>(() => getSavedMatchKeys())
  const [flow, setFlow] = useState<FlowState>({ flowId: null, stepIndex: 0, answers: {} })
  const [template, setTemplate] = useState<ExportTemplate>('poster')
  const [posterVariant, setPosterVariant] = useState<PosterVariant>(
    prefs.themeMode === 'program' ? 'light' : 'dark',
  )
  const [message, setMessage] = useState('')
  const [reminderSummary, setReminderSummary] = useState('')
  const [hiddenReviewTargets, setHiddenReviewTargets] = useState<Array<Pick<ReviewPick, 'targetType' | 'targetId' | 'label'>>>([])
  const [undoTarget, setUndoTarget] = useState<Pick<ReviewPick, 'targetType' | 'targetId' | 'label'> | null>(null)
  const [previewQuery, setPreviewQuery] = useState('')
  const [previewPage, setPreviewPage] = useState(1)
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false)

  const timeZone = prefs.timezone
  const cityLabel = cityLabelFor(prefs.timezone, prefs.city)
  const nowMs = useNow()
  const { matches } = useMatches()
  const hiddenKeys = useMemo(() => new Set(hiddenReviewTargets.map(reviewKey)), [hiddenReviewTargets])
  const activeFollowedTeams = useMemo(
    () => followedTeams.filter((team) => !hiddenKeys.has(reviewKey({ targetType: 'team', targetId: team }))),
    [followedTeams, hiddenKeys],
  )
  const activeFollowedLeagueIds = useMemo(
    () => followedLeagueIds.filter((id) => !hiddenKeys.has(reviewKey({ targetType: 'league', targetId: id }))),
    [followedLeagueIds, hiddenKeys],
  )
  const activeFollowedCompetitorIds = useMemo(
    () => followedCompetitorIds.filter((id) => !hiddenKeys.has(reviewKey({ targetType: 'competitor', targetId: id }))),
    [followedCompetitorIds, hiddenKeys],
  )
  const myEvents = useMyEvents(activeFollowedLeagueIds, activeFollowedCompetitorIds)
  const hasLiveFollows = activeFollowedLeagueIds.length > 0 || activeFollowedCompetitorIds.length > 0

  useEffect(() => {
    if (!flow.flowId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlow({ flowId: null, stepIndex: 0, answers: {} })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [flow.flowId])

  useEffect(() => {
    if (!undoTarget) return
    const timeout = window.setTimeout(() => setUndoTarget(null), 3000)
    return () => window.clearTimeout(timeout)
  }, [undoTarget])

  // Base set = matches for followed teams PLUS individually-saved matches ("Add to schedule"),
  // deduped. So saving a single match surfaces it here without following the whole nation.
  const baseMatches = useMemo(() => {
    const key = (m: Match) => `${m.date}-${m.team1}-${m.team2}`
    // filterMatchesForTeams returns ALL matches when nothing is selected, but My Schedule should
    // only show what the user actually chose — followed nations and individually-saved matches.
    const followed = activeFollowedTeams.length ? filterMatchesForTeams(matches, activeFollowedTeams) : []
    const followedKeys = new Set(followed.map(key))
    const savedSet = new Set(savedMatchKeys)
    const savedOnly = matches.filter((m) => savedSet.has(key(m)) && !followedKeys.has(key(m)))
    return [...followed, ...savedOnly]
  }, [matches, activeFollowedTeams, savedMatchKeys])

  const schedule = useMemo(() => {
    return baseMatches
      .filter(
        (match) =>
          inRange(match.startsAt, range, nowMs) &&
          (!hidePast || match.startsAt.getTime() > nowMs - 2 * 3600_000),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  }, [baseMatches, range, hidePast, nowMs])

  const savedWorldCupSchedule = useMemo(
    () => [...baseMatches].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [baseMatches],
  )

  const fullWorldCupSchedule = useMemo(
    () => [...matches].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [matches],
  )

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

  const totalVisible = schedule.length + liveSchedule.length
  const followCount = activeFollowedTeams.length + activeFollowedLeagueIds.length + activeFollowedCompetitorIds.length
  const tbdSlotCount = allMatches.length - groupMatches.length
  const activeFlow = flow.flowId ? guidedFlows[flow.flowId] : null
  const currentStep = activeFlow?.steps[flow.stepIndex]
  const currentAnswer = currentStep ? flow.answers[currentStep.id] : undefined

  const selectedTeamsSummary =
    activeFollowedTeams.length === 0
      ? 'No World Cup teams yet'
      : activeFollowedTeams.length <= 4
        ? activeFollowedTeams.join(', ')
        : `${activeFollowedTeams.slice(0, 4).join(', ')} +${activeFollowedTeams.length - 4}`

  const liveStatus = myEvents.loading
    ? 'Checking live sports data...'
    : hasLiveFollows
      ? 'Live follows read from Silbo DB'
      : 'World Cup picks stored on this device'

  const followCounts = useMemo(
    () => activeFollowedTeams.map((team) => ({ team, count: filterMatchesForTeams(matches, [team]).length })),
    [matches, activeFollowedTeams],
  )
  const reviewPicks = useMemo<ReviewPick[]>(() => {
    const leagueLabels = new Map<string, { label: string; group: string; count: number }>()
    const competitorLabels = new Map<string, { label: string; group: string; count: number }>()
    for (const event of myEvents.events) {
      const group = event.sportKey ? `${sportEmoji(event.sportKey)} ${event.sportKey.replace(/_/g, ' ')}` : 'Live sports'
      if (event.leagueId) {
        const current = leagueLabels.get(event.leagueId)
        leagueLabels.set(event.leagueId, {
          label: event.leagueName || current?.label || 'League follow',
          group,
          count: (current?.count ?? 0) + 1,
        })
      }
      for (const participant of event.participants ?? []) {
        const current = competitorLabels.get(participant.id)
        competitorLabels.set(participant.id, {
          label: participant.name || current?.label || 'Team/player follow',
          group,
          count: (current?.count ?? 0) + 1,
        })
      }
    }

    return [
      ...followCounts.map(({ team, count }) => ({ targetType: 'team' as const, targetId: team, label: team, group: 'World Cup', count })),
      ...activeFollowedLeagueIds.map((id) => {
        const info = leagueLabels.get(id)
        return { targetType: 'league' as const, targetId: id, label: info?.label ?? 'League follow', group: info?.group ?? 'Live sports', count: info?.count ?? 0 }
      }),
      ...activeFollowedCompetitorIds.map((id) => {
        const info = competitorLabels.get(id)
        return { targetType: 'competitor' as const, targetId: id, label: info?.label ?? 'Team/player follow', group: info?.group ?? 'Live sports', count: info?.count ?? 0 }
      }),
    ]
  }, [activeFollowedCompetitorIds, activeFollowedLeagueIds, followCounts, myEvents.events])

  const reviewGroups = useMemo(() => {
    const groups = new Map<string, ReviewPick[]>()
    for (const pick of reviewPicks) {
      const group = groups.get(pick.group) ?? []
      group.push(pick)
      groups.set(pick.group, group)
    }
    return [...groups.entries()]
  }, [reviewPicks])

  const previewItems = useMemo<PreviewItem[]>(() => {
    const worldCupItems: PreviewItem[] = schedule.map((match) => ({
      id: `wc:${match.date}:${match.team1}:${match.team2}`,
      title: `${match.team1} vs ${match.team2}`,
      subtitle: ['World Cup', match.group || match.round].filter(Boolean).join(' - '),
      startsAt: match.startsAt,
      venue: match.ground,
      sportKey: 'soccer',
      searchable: `${match.team1} ${match.team2} ${match.group ?? ''} ${match.round} ${match.ground} World Cup`,
      match,
    }))
    const liveItems: PreviewItem[] = liveSchedule.map((event) => ({
      id: `live:${event.id}`,
      title: event.title,
      subtitle: [event.leagueName, event.sportKey?.replace(/_/g, ' ')].filter(Boolean).join(' - '),
      startsAt: event.startsAt,
      venue: event.venue ?? '',
      sportKey: event.sportKey ?? 'soccer',
      searchable: `${event.title} ${event.leagueName} ${event.venue ?? ''} ${(event.participants ?? []).map((p) => p.name).join(' ')}`,
    }))
    return [...worldCupItems, ...liveItems].sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity))
  }, [liveSchedule, schedule])

  const filteredPreviewItems = useMemo(() => {
    const query = previewQuery.trim().toLowerCase()
    return query ? previewItems.filter((item) => item.searchable.toLowerCase().includes(query)) : previewItems
  }, [previewItems, previewQuery])
  const previewPageCount = compactPageCount(filteredPreviewItems.length)
  const activePreviewPage = Math.min(previewPage, previewPageCount)
  const pagedPreviewItems = useMemo(
    () => filteredPreviewItems.slice((activePreviewPage - 1) * REVIEW_PAGE_SIZE, activePreviewPage * REVIEW_PAGE_SIZE),
    [activePreviewPage, filteredPreviewItems],
  )

  useEffect(() => {
    queueMicrotask(() => {
      setPreviewPage(1)
      setMobilePreviewExpanded(false)
    })
  }, [previewQuery, range, hidePast, hiddenReviewTargets.length])

  function removeReviewPick(pick: ReviewPick) {
    const target = { targetType: pick.targetType, targetId: pick.targetId, label: pick.label }
    setHiddenReviewTargets((current) => (current.some((item) => reviewKey(item) === reviewKey(target)) ? current : [...current, target]))
    setUndoTarget(target)
  }

  function undoRemove() {
    if (!undoTarget) return
    setHiddenReviewTargets((current) => current.filter((item) => reviewKey(item) !== reviewKey(undoTarget)))
    setUndoTarget(null)
  }

  function exportLiveIcs() {
    downloadBlob(
      createMultiSportIcsBlob(liveSchedule, { reminderMinutes: [60] }),
      exportFilename('live-schedule', 'ics'),
    )
    setMessage('All-sports calendar downloaded with 1-hour reminders.')
  }

  function matchesForScope(scope = 'all_saved') {
    if (scope === 'visible_matches') return schedule
    if (scope === 'full_tournament') return fullWorldCupSchedule
    return savedWorldCupSchedule
  }

  function pageCountForScope(scope = 'all_saved') {
    const pages = paginateEvents(matchesForScope(scope), template)
    return pages.length
  }

  async function exportIcs(matchesToExport = schedule) {
    downloadBlob(createIcsBlob(matchesToExport, timeZone, prefs.locale, prefs.hour12), exportFilename('schedule', 'ics'))
    setMessage(exportCompletionMessage('ics'))
  }

  async function exportCsv(matchesToExport = schedule) {
    const csv = createScheduleCsv(matchesToExport, timeZone, prefs.locale, prefs.hour12)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), exportFilename('schedule', 'csv'))
    setMessage(exportCompletionMessage('csv'))
  }

  async function exportImages(share: boolean, matchesToExport = schedule) {
    let pageNumber = 1
    const exportPages = paginateEvents(matchesToExport, template)
    for (const pageEvents of exportPages) {
      const canvas = await createScheduleCanvas(
        pageEvents,
        activeFollowedTeams,
        timeZone,
        cityLabel,
        {
          page: pageNumber,
          pageCount: exportPages.length,
        },
        posterVariant,
        prefs.locale,
        prefs.hour12,
      )
      if (!canvas) continue
      const blob = await canvasToBlob(canvas)
      const filename =
        exportPages.length > 1 ? `silbo-schedule-${pageNumber}-of-${exportPages.length}.png` : exportFilename('schedule', 'png')
      const file = new File([blob], filename, { type: 'image/png' })

      if (share && exportPages.length === 1 && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: brand.scheduleTitle, files: [file] })
        setMessage('Image opened in your share sheet.')
        return
      }
      downloadBlob(blob, filename)
      pageNumber += 1
    }
    setMessage(exportCompletionMessage(exportPages.length > 1 ? 'images' : 'image', exportPages.length))
  }

  async function exportPdf(matchesToExport = schedule) {
    let pageNumber = 1
    const exportPages = paginateEvents(matchesToExport, template)
    const pdfPages = []
    for (const pageEvents of exportPages) {
      const canvas = await createScheduleCanvas(
        pageEvents,
        activeFollowedTeams,
        timeZone,
        cityLabel,
        {
          page: pageNumber,
          pageCount: exportPages.length,
        },
        posterVariant,
        prefs.locale,
        prefs.hour12,
      )
      if (canvas) pdfPages.push(await canvasToJpegPage(canvas))
      pageNumber += 1
    }
    const blob = createPdfBlobFromImages(pdfPages, posterVariant)
    downloadBlob(blob, exportFilename('schedule', 'pdf'))
    setMessage(exportCompletionMessage('pdf', pdfPages.length))
  }

  async function copyNotes(matchesToExport = schedule) {
    const text = createNotesText(matchesToExport, activeFollowedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12)
    await copyToClipboard(text)
    setMessage(exportCompletionMessage('notes'))
  }

  async function copyLiveNotes() {
    const text = createMultiSportNotesText(liveSchedule, timeZone, cityLabel, prefs.locale, prefs.hour12)
    await copyToClipboard(text)
    setMessage(`All-sports text schedule copied - ${liveSchedule.length} events.`)
  }

  async function shareSchedule(matchesToExport = schedule) {
    const text = createNotesText(matchesToExport, activeFollowedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12)
    if (navigator.share) {
      await navigator.share({ title: brand.scheduleTitle, text })
      setMessage(exportCompletionMessage('share'))
      return
    }
    await copyToClipboard(text)
    setMessage('Schedule copied for sharing.')
  }

  function openFlow(flowId: GuidedFlowId) {
    setMessage('')
    setFlow({ flowId, stepIndex: 0, answers: {} })
  }

  function closeFlow() {
    setFlow({ flowId: null, stepIndex: 0, answers: {} })
  }

  function answerStep(step: FlowStep, answer: string) {
    setFlow((current) => ({
      ...current,
      answers: { ...current.answers, [step.id]: answer },
    }))
  }

  function nextStep() {
    if (!activeFlow || !currentStep) return
    setMessage('')
    const answer = currentAnswer || defaultAnswer(currentStep)
    setFlow((current) => ({
      ...current,
      answers: answer ? { ...current.answers, [currentStep.id]: answer } : current.answers,
      stepIndex: Math.min(current.stepIndex + 1, activeFlow.steps.length - 1),
    }))
  }

  function previousStep() {
    setMessage('')
    setFlow((current) => ({
      ...current,
      stepIndex: Math.max(current.stepIndex - 1, 0),
    }))
  }

  function defaultAnswer(step: FlowStep | undefined) {
    if (step?.id === 'calendar_update_mode' && !hasLiveFollows) return 'one_time_import'
    return step?.options?.find((option) => option.recommended)?.id ?? step?.options?.[0]?.id ?? ''
  }

  async function runDownloadAction() {
    const matchesToExport = matchesForScope(flow.answers.download_scope)
    const intent = flow.answers.download_intent ?? 'calendar_import'
    if (intent === 'edit_spreadsheet') return exportCsv(matchesToExport)
    if (intent === 'calendar_import') return exportIcs(matchesToExport)
    if (intent === 'share_copy') return shareSchedule(matchesToExport)
    return exportPdf(matchesToExport)
  }

  async function runCalendarAction() {
    const matchesToExport = matchesForScope(flow.answers.calendar_scope)
    if ((flow.answers.calendar_update_mode ?? 'live_subscription') === 'one_time_import') {
      return exportIcs(matchesToExport)
    }
    setMessage('Use the Silbo Sync controls to create, copy, or open a live calendar feed.')
  }

  function enableReminderFlow() {
    const scope = optionLabel(
      guidedFlows.reminders.steps.find((step) => step.id === 'reminder_scope'),
      flow.answers.reminder_scope,
      'All saved matches',
    )
    const timing = optionLabel(
      guidedFlows.reminders.steps.find((step) => step.id === 'reminder_timing'),
      flow.answers.reminder_timing,
      '1 hour before',
    )
    setReminderSummary(`${scope}, ${timing.toLowerCase()}`)
    setMessage('Reminder preference noted. The notification setup page still controls delivery channels.')
  }

  function finalActionLabel() {
    if (flow.flowId === 'calendar') {
      return (flow.answers.calendar_update_mode ?? 'live_subscription') === 'one_time_import'
        ? 'Download calendar file'
        : 'Done'
    }
    if (flow.flowId === 'download') {
      const intent = flow.answers.download_intent ?? 'calendar_import'
      if (intent === 'edit_spreadsheet') return 'Download CSV'
      if (intent === 'calendar_import') return 'Download ICS'
      if (intent === 'share_copy') return 'Share schedule'
      return 'Download PDF'
    }
    if (flow.flowId === 'reminders') return 'Enable reminders'
    return 'Save settings'
  }

  function finalRecommendation() {
    if (flow.flowId === 'calendar') {
      const live = (flow.answers.calendar_update_mode ?? 'live_subscription') === 'live_subscription'
      const scope = optionLabel(guidedFlows.calendar.steps[1], flow.answers.calendar_scope, 'All saved matches')
      const provider = optionLabel(guidedFlows.calendar.steps[2], flow.answers.calendar_provider, 'your calendar app')
      return live
        ? `Recommended: live subscription for ${scope.toLowerCase()} in ${provider}. It can update when details change.`
        : `Recommended: one-time ICS file for ${scope.toLowerCase()} in ${provider}. Future changes will not auto-update.`
    }
    if (flow.flowId === 'download') {
      const intent = flow.answers.download_intent ?? 'calendar_import'
      const scope = optionLabel(guidedFlows.download.steps[1], flow.answers.download_scope, 'All saved matches')
      if (intent === 'edit_spreadsheet') return `Recommended: CSV for ${scope.toLowerCase()}, ready for spreadsheet editing.`
      if (intent === 'calendar_import') return `Recommended: ICS for ${scope.toLowerCase()}, the best static export for tracking in a calendar.`
      if (intent === 'share_copy') return `Recommended: share text for ${scope.toLowerCase()}, easy to send from this device.`
      return `Recommended: PDF for ${scope.toLowerCase()}, using the same branded schedule design as image exports.`
    }
    if (flow.flowId === 'reminders') {
      const scope = optionLabel(guidedFlows.reminders.steps[0], flow.answers.reminder_scope, 'All saved matches')
      const timing = optionLabel(guidedFlows.reminders.steps[1], flow.answers.reminder_timing, '1 hour before')
      return `We will mark ${scope.toLowerCase()} for reminders ${timing.toLowerCase()}, using ${timeZone}.`
    }
    return `Times are shown in ${cityLabel}. Hide finished matches is ${hidePast ? 'on' : 'off'}.`
  }

  function finalSelectionSummary() {
    if (flow.flowId === 'download') return `${matchesForScope(flow.answers.download_scope).length} World Cup matches selected.`
    if (flow.flowId === 'calendar') {
      if ((flow.answers.calendar_update_mode ?? 'live_subscription') === 'live_subscription') {
        const liveFollowCount = activeFollowedLeagueIds.length + activeFollowedCompetitorIds.length
        return liveFollowCount
          ? `${liveFollowCount} followed leagues/players included in the live feed.`
          : 'No live league/player follows yet. Use a one-time ICS for World Cup team picks.'
      }
      return `${matchesForScope(flow.answers.calendar_scope).length} World Cup matches selected.`
    }
    return `${totalVisible} visible events in ${cityLabel}.`
  }

  function downloadMethod(): ExportAdviceMethod {
    const intent = flow.answers.download_intent ?? 'calendar_import'
    if (intent === 'edit_spreadsheet') return 'csv'
    if (intent === 'calendar_import') return 'ics'
    if (intent === 'share_copy') return 'share'
    return 'pdf'
  }

  function bestFitAdvice() {
    if (flow.flowId === 'download') {
      const method = downloadMethod()
      const scope = flow.answers.download_scope ?? 'all_saved'
      const eventCount = matchesForScope(scope).length
      return buildExportAdvice({
        method,
        eventCount,
        pageCount: method === 'pdf' || method === 'share' ? pageCountForScope(scope) : 0,
        hasLiveFollows,
        liveEventCount: liveSchedule.length,
        includesChangingDetails: scope === 'full_tournament' || tbdSlotCount > 0 || hasLiveFollows,
      })
    }
    if (flow.flowId === 'calendar') {
      const live = (flow.answers.calendar_update_mode ?? 'live_subscription') === 'live_subscription'
      const eventCount = live ? liveSchedule.length : matchesForScope(flow.answers.calendar_scope).length
      return buildExportAdvice({
        method: live ? 'live' : 'one_time_calendar',
        eventCount,
        hasLiveFollows,
        liveEventCount: liveSchedule.length,
        includesChangingDetails: tbdSlotCount > 0 || hasLiveFollows || flow.answers.calendar_scope === 'full_tournament',
      })
    }
    return null
  }

  function runFinalAction() {
    if (flow.flowId === 'download') void runDownloadAction()
    if (flow.flowId === 'calendar') void runCalendarAction()
    if (flow.flowId === 'reminders') enableReminderFlow()
    if (flow.flowId === 'settings') {
      setMessage('Schedule settings saved for this view.')
    }
  }

  const currentBestFitAdvice = currentStep?.final ? bestFitAdvice() : null

  if (followedTeams.length === 0 && followedLeagueIds.length === 0 && followedCompetitorIds.length === 0 && savedMatchKeys.length === 0) {
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

      <AlertOptInNudge />

      {activeFlow && currentStep &&
        createPortal(
        <div className="fixed inset-0 z-50 bg-void/70">
          {/* Deliberate close only: a double-click outside dismisses, so a stray tap or tab-switch
              never wipes choices in progress. The header X is the primary close. */}
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Double-click to close"
            title="Double-click to close"
            onDoubleClick={closeFlow}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={activeFlow.title}
            className="absolute inset-x-0 bottom-0 max-h-[92svh] overflow-y-auto rounded-t-card border border-primary/20 bg-surface p-4 shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(540px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                  Step {flow.stepIndex + 1} of {activeFlow.steps.length}
                </p>
                <h2 className="mt-1 text-xl font-extrabold text-primary">{activeFlow.title}</h2>
                <p className="mt-1 text-sm text-ink/60">{currentStep.question}</p>
              </div>
              <Button variant="ghost" className="px-2" onClick={closeFlow} aria-label="Close guide">
                <X size={16} />
              </Button>
            </div>

            {!currentStep.final && currentStep.options && (
              <div className="space-y-2">
                {currentStep.options.map((option) => {
                  const selected = (currentAnswer || defaultAnswer(currentStep)) === option.id
                  const liveSyncUnavailable =
                    currentStep.id === 'calendar_update_mode' && option.id === 'live_subscription' && !hasLiveFollows
                  const recommended = Boolean(option.recommended && !liveSyncUnavailable)
                  const description = liveSyncUnavailable
                    ? 'Follow a live league or player first. World Cup team picks can be added once with an ICS file.'
                    : option.description
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => answerStep(currentStep, option.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        selected ? 'border-primary bg-primary text-void' : 'border-primary/25 bg-page/60 hover:border-primary/45'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2 text-sm font-bold">
                        {option.label}
                        {recommended && (
                          <span className={`font-mono text-[10px] uppercase ${selected ? 'text-void/65' : 'text-primary'}`}>
                            Recommended
                          </span>
                        )}
                      </span>
                      {description && (
                        <span className={`mt-1 block text-xs ${selected ? 'text-void/70' : 'text-ink/55'}`}>
                          {description}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {currentStep.final && (
              <div className="space-y-4">
                <Panel className="bg-page/55">
                  <p className="text-sm font-semibold text-ink">{finalRecommendation()}</p>
                  <p className="mt-2 text-xs text-ink/55">
                    {finalSelectionSummary()}
                  </p>
                </Panel>

                {currentBestFitAdvice && (
                  <div className={`rounded-lg border p-3 ${adviceToneClasses(currentBestFitAdvice.tone)}`}>
                    <div className="flex items-start gap-2">
                      <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">Best fit check</p>
                        <p className="mt-1 text-sm font-bold text-ink">{currentBestFitAdvice.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-ink/65">{currentBestFitAdvice.body}</p>
                      </div>
                    </div>
                  </div>
                )}

                {flow.flowId === 'download' && (flow.answers.download_intent ?? 'calendar_import') === 'share_copy' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="w-full" variant="subtle" onClick={() => copyNotes(matchesForScope(flow.answers.download_scope))}>
                      <Copy size={15} /> Copy text
                    </Button>
                    <Button className="w-full" variant="ghost" onClick={() => exportImages(true, matchesForScope(flow.answers.download_scope))}>
                      <FileImage size={15} /> Save image backup
                    </Button>
                    {liveSchedule.length > 0 && (
                      <Button className="w-full" variant="ghost" onClick={copyLiveNotes}>
                        <Copy size={15} /> Copy all-sports text
                      </Button>
                    )}
                  </div>
                )}

                {/* Image template + style only matter for an actual image/PDF export — hidden for
                    text/ICS/CSV so the size picker doesn't show when it's irrelevant. */}
                {flow.flowId === 'download' &&
                  (flow.answers.download_intent ?? 'calendar_import') === 'print_or_save' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setTemplate(item.key)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                            template === item.key
                              ? 'border-primary bg-primary text-void'
                              : 'border-primary/25 bg-page/60 hover:border-primary/45'
                          }`}
                        >
                          {t(item.labelKey, undefined, prefs.locale)}
                          <span className={`block text-xs font-normal ${template === item.key ? 'text-void/70' : 'text-ink/50'}`}>
                            {item.hint}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">Image style</span>
                      <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-primary/20">
                        {(['light', 'dark'] as const).map((variantKey) => (
                          <button
                            key={variantKey}
                            type="button"
                            aria-pressed={posterVariant === variantKey}
                            onClick={() => setPosterVariant(variantKey)}
                            className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                              posterVariant === variantKey
                                ? 'bg-primary text-void'
                                : 'bg-page/60 text-ink/60 hover:text-primary'
                            }`}
                          >
                            {variantKey}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-ink/50">
                      {flow.answers.download_intent === 'print_or_save'
                        ? `PDF pages paginate at ${MAX_EVENTS_BY_TEMPLATE[template]} events per page.`
                        : `Poster images paginate at ${MAX_EVENTS_BY_TEMPLATE[template]} events per page if you choose the image path.`}
                    </p>
                  </div>
                )}

                {flow.flowId === 'download' &&
                  (flow.answers.download_intent ?? 'calendar_import') === 'calendar_import' &&
                  liveSchedule.length > 0 && (
                    <Button className="w-full" variant="ghost" onClick={exportLiveIcs}>
                      <CalendarDays size={15} /> Download all-sports ICS ({liveSchedule.length})
                    </Button>
                  )}

                {flow.flowId === 'calendar' &&
                  (flow.answers.calendar_update_mode ?? 'live_subscription') === 'live_subscription' && <CalendarFeedsPage embedded />}

                {flow.flowId === 'reminders' && (
                  <div className="rounded-lg border border-primary/20 bg-page/50 p-3 text-sm text-ink/65">
                    Calendar files can include a 1-hour reminder today. Email and push delivery still live in the reminder settings.
                    <Link to="/settings/alerts" className="mt-3 inline-flex items-center gap-2 font-semibold text-primary">
                      Open reminder settings
                    </Link>
                  </div>
                )}

                {flow.flowId === 'settings' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-primary/20 bg-page/50 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">Timezone</p>
                      <p className="mt-1 text-sm font-semibold">{timeZone}</p>
                    </div>
                    <CityPicker />
                    <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-page/50 px-3 py-2 text-sm text-ink/70">
                      <input type="checkbox" checked={hidePast} onChange={(event) => setHidePast(event.target.checked)} />
                      Hide finished matches
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation stays in the modal so you can export again (a PDF, then a story image,
                then a sync) without it closing and losing your choices. */}
            {message && (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm font-medium text-primary">
                <CalendarCheck size={15} className="shrink-0" /> {message}
              </p>
            )}

            <div className="sticky bottom-0 -mx-4 mt-5 flex items-center gap-2 border-t border-primary/15 bg-surface px-4 pt-3">
              {flow.stepIndex > 0 ? (
                <Button variant="ghost" onClick={previousStep}>
                  <ChevronLeft size={15} /> Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={closeFlow}>
                  Close
                </Button>
              )}
              <span className="flex-1" />
              {currentStep.final ? (
                <Button
                  variant={flow.flowId === 'download' ? 'export' : 'solid'}
                  onClick={runFinalAction}
                  disabled={
                    (flow.flowId === 'download' && matchesForScope(flow.answers.download_scope).length === 0) ||
                    (flow.flowId === 'calendar' &&
                      (flow.answers.calendar_update_mode ?? 'live_subscription') === 'one_time_import' &&
                      matchesForScope(flow.answers.calendar_scope).length === 0)
                  }
                >
                  {flow.flowId === 'download' && (flow.answers.download_intent ?? 'calendar_import') === 'edit_spreadsheet' && (
                    <FileSpreadsheet size={15} />
                  )}
                  {flow.flowId === 'download' && (flow.answers.download_intent ?? 'calendar_import') === 'print_or_save' && (
                    <Printer size={15} />
                  )}
                  {flow.flowId === 'download' && (flow.answers.download_intent ?? 'calendar_import') === 'share_copy' && (
                    <Share2 size={15} />
                  )}
                  {flow.flowId === 'download' &&
                    !['edit_spreadsheet', 'print_or_save', 'share_copy'].includes(flow.answers.download_intent ?? 'calendar_import') && (
                    <Download size={15} />
                  )}
                  {flow.flowId === 'calendar' && <CalendarCheck size={15} />}
                  {flow.flowId === 'reminders' && <BellRing size={15} />}
                  {flow.flowId === 'settings' && <SlidersHorizontal size={15} />}
                  {finalActionLabel()}
                </Button>
              ) : (
                <Button onClick={nextStep}>Continue</Button>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-3">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <ListFilter size={16} className="text-primary" />
              {ranges.map((item) => (
                <Button key={item.key} variant={range === item.key ? 'solid' : 'ghost'} onClick={() => setRange(item.key)}>
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

          <Panel className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <PanelHeading title="Review schedule" subtitle={`${filteredPreviewItems.length} events after filters and removed picks`} />
              <label className="flex h-10 min-w-[240px] items-center gap-2 rounded-lg border border-primary/20 bg-page/60 px-3">
                <Search size={15} className="text-ink/40" />
                <input
                  value={previewQuery}
                  onChange={(event) => setPreviewQuery(event.target.value)}
                  placeholder="Search matches, teams, leagues"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-ink/40"
                />
              </label>
            </div>

            {pagedPreviewItems.length > 0 ? (
              <>
                <ul className={`space-y-1.5 md:max-h-none ${mobilePreviewExpanded ? '' : 'max-h-[236px] overflow-hidden'}`}>
                  {pagedPreviewItems.map((item) => (
                    <CompactScheduleRow
                      key={item.id}
                      item={item}
                      timeZone={timeZone}
                      locale={prefs.locale}
                      hour12={prefs.hour12}
                    />
                  ))}
                </ul>
                {pagedPreviewItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setMobilePreviewExpanded((expanded) => !expanded)}
                    className="flex w-full items-center justify-center rounded-lg border border-primary/20 px-3 py-2 text-sm font-bold text-primary md:hidden"
                  >
                    {mobilePreviewExpanded ? 'Collapse preview' : `Show ${pagedPreviewItems.length - 3} more on this page`}
                  </button>
                )}
              </>
            ) : (
              <EmptyState
                title={previewQuery ? 'No matching events' : t('schedule.noRangeTitle', undefined, prefs.locale)}
                body={previewQuery ? 'Try a team, league, venue, or competition name from your selected schedule.' : t('schedule.noRangeBody', undefined, prefs.locale)}
              />
            )}

            {filteredPreviewItems.length > REVIEW_PAGE_SIZE && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">
                  Page {activePreviewPage} of {previewPageCount}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={activePreviewPage === 1} onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}>
                    Previous
                  </Button>
                  <Button variant="ghost" disabled={activePreviewPage === previewPageCount} onClick={() => setPreviewPage((page) => Math.min(previewPageCount, page + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-primary/10 pt-3 text-xs font-semibold text-ink/50">
              <span>{totalVisible} visible {totalVisible === 1 ? 'event' : 'events'}</span>
              <span>{dateRangeLabel(allVisibleDates, timeZone, prefs.locale, prefs.hour12)}</span>
              <span>{selectedTeamsSummary} / {venueCount} {venueCount === 1 ? 'venue' : 'venues'}</span>
              <span>{liveStatus}</span>
            </div>
          </Panel>
        </section>

        <Panel className="h-fit space-y-3 xl:sticky xl:top-20">
          <PanelHeading title="Included picks" subtitle={`${followCount} active follows`} />
          {undoTarget && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-ink/70">
              <span className="min-w-0 flex-1 truncate">Removed {undoTarget.label}.</span>
              <button type="button" onClick={undoRemove} className="inline-flex items-center gap-1 font-bold text-primary">
                <RotateCcw size={12} /> Undo remove
              </button>
            </div>
          )}
          <div className="space-y-3">
            {reviewGroups.map(([group, picks]) => (
              <div key={group} className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">{group}</p>
                <div className="flex flex-wrap gap-1.5">
                  {picks.map((pick) => (
                    <span
                      key={reviewKey(pick)}
                      className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-page/70 px-2.5 py-1 text-xs font-bold text-ink/75"
                    >
                      <span className="truncate">{pick.label}</span>
                      <span className="font-mono text-[10px] text-ink/40">{pick.count}</span>
                      <button
                        type="button"
                        onClick={() => removeReviewPick(pick)}
                        title={`Remove ${pick.label} from this export`}
                        className="rounded-full text-ink/25 opacity-70 transition-opacity hover:text-flap-chg group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {reviewPicks.length === 0 && (
              <p className="rounded-lg border border-primary/15 bg-page/50 px-3 py-2 text-sm text-ink/55">
                Everything is temporarily removed. Use undo or add more picks.
              </p>
            )}
          </div>
          <Link
            to="/sports/soccer"
            className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/8"
          >
            <Plus size={14} /> Add a pick
          </Link>
        </Panel>
      </div>

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PanelHeading
            title="Export or sync"
            subtitle="Final step. Your compact review above is what these actions use."
          />
          {message && <p className="text-sm font-medium text-primary">{message}</p>}
          {!message && reminderSummary && <p className="text-sm font-medium text-primary">Reminders: {reminderSummary}</p>}
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <button type="button" onClick={() => openFlow('calendar')} className="rounded-lg border border-primary/20 bg-page/60 px-3 py-3 text-left transition-colors hover:bg-primary/8">
            <CalendarCheck size={18} />
            <span className="mt-2 block text-sm font-bold">Add to calendar</span>
            <span className="mt-1 block text-xs text-ink/55">Live updates or one-time import.</span>
          </button>
          <button type="button" onClick={() => openFlow('download')} className="rounded-lg border border-export/25 bg-page/60 px-3 py-3 text-left transition-colors hover:bg-export/8">
            <Download size={18} />
            <span className="mt-2 block text-sm font-bold">Download</span>
            <span className="mt-1 block text-xs text-ink/55">PDF, CSV, ICS, or share.</span>
          </button>
          <button type="button" onClick={() => openFlow('reminders')} className="rounded-lg border border-primary/20 bg-page/60 px-3 py-3 text-left transition-colors hover:bg-primary/8">
            <BellRing size={18} />
            <span className="mt-2 block text-sm font-bold">Reminders</span>
            <span className="mt-1 block text-xs text-ink/55">Kickoff and change alerts.</span>
          </button>
          <button type="button" onClick={() => openFlow('settings')} className="rounded-lg border border-primary/20 bg-page/60 px-3 py-3 text-left transition-colors hover:bg-primary/8">
            <SlidersHorizontal size={18} />
            <span className="mt-2 block text-sm font-bold">Settings</span>
            <span className="mt-1 block text-xs text-ink/55">Timezone and display.</span>
          </button>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-flap-tbd/50 bg-flap-tbd/8 px-4 py-3">
        <span className="flap flap-tbd shrink-0">{t('schedule.tbdDates', undefined, prefs.locale)}</span>
        <p className="min-w-0 flex-1 text-sm text-ink/70">
          {t('schedule.tbdBody', { count: tbdSlotCount }, prefs.locale)}
        </p>
      </div>
    </div>
  )
}
