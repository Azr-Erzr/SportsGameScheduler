import { CalendarDays, Copy, Download, FileImage, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { cityLabelFor } from '../lib/cities'
import { Button, Panel, PanelHeading } from '../components/ui'
import { filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { useMyEvents } from '../data/liveSport'
import { brand, exportFilename } from '../domain/brand'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { createIcsBlob, createMultiSportIcsBlob } from '../lib/ics'
import { createNotesText } from '../lib/notes'
import { MAX_EVENTS_BY_TEMPLATE, paginateEvents, type ExportTemplate } from '../lib/paginate'
import { canvasToBlob, createScheduleCanvas } from '../lib/poster'
import { formatDate, formatTime } from '../lib/time'
import { posterChromeTheme } from '../theme/themes'

const templates: Array<{ key: ExportTemplate; label: string; hint: string }> = [
  { key: 'story', label: 'Phone story', hint: '7 events/page' },
  { key: 'poster', label: 'Poster', hint: '9 events/page' },
  { key: 'compact', label: 'Compact list', hint: '12 events/page' },
  { key: 'family', label: 'Family board', hint: '6 events/page' },
]

export function ExportStudioPage() {
  const { followedTeams, followedLeagueIds, followedCompetitorIds, prefs } = useAppState()
  const [template, setTemplate] = useState<ExportTemplate>('poster')
  const [message, setMessage] = useState('')

  const timeZone = prefs.timezone
  const cityLabel = cityLabelFor(prefs.timezone, prefs.city)
  const { matches } = useMatches()
  const schedule = useMemo(() => filterMatchesForTeams(matches, followedTeams), [matches, followedTeams])
  const pages = useMemo(() => paginateEvents(schedule, template), [schedule, template])

  // Multi-sport calendar: all upcoming events from followed leagues + competitors, any sport.
  const myEvents = useMyEvents(followedLeagueIds, followedCompetitorIds)

  function exportAllSportsIcs() {
    downloadBlob(
      createMultiSportIcsBlob(myEvents.events, { reminderMinutes: [60] }),
      exportFilename('all-sports', 'ics'),
    )
    setMessage(`All-sports calendar downloaded — ${myEvents.events.length} events with 1-hour reminders.`)
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
        ? `${pages.length} readable pages downloaded - long schedules never shrink into tiny text.`
        : 'Schedule image downloaded.',
    )
  }

  async function exportIcs() {
    const blob = createIcsBlob(schedule, timeZone, prefs.locale, prefs.hour12)
    const file = new File([blob], exportFilename('schedule', 'ics'), { type: 'text/calendar' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: brand.scheduleTitle, files: [file] })
      setMessage('Calendar file opened in your share sheet.')
      return
    }
    downloadBlob(blob, exportFilename('schedule', 'ics'))
    setMessage('Calendar snapshot downloaded. For ongoing updates, create a Silbo Sync feed instead.')
  }

  async function copyNotes() {
    const text = createNotesText(schedule, followedTeams, timeZone, cityLabel, prefs.locale, prefs.hour12)
    if (navigator.share) {
      await navigator.share({ title: brand.scheduleTitle, text })
      setMessage('Text schedule opened in your share sheet.')
      return
    }
    await copyToClipboard(text)
    setMessage('Plain-text schedule copied - paste into Notes, Keep, Notion, or a group chat.')
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">Silbo Exports</h1>
        <p className="text-sm text-ink/60">
          Choose live subscribed feeds for schedule changes, or static packs for quick saving, sharing, and no-signup downloads.
        </p>
      </div>

      <Panel className="grid gap-3 md:grid-cols-2">
        <Link to="/calendar" className="rounded-xl border border-primary/20 bg-page/60 p-4 transition-colors hover:bg-primary/5">
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays size={18} />
            <h2 className="font-bold">Live Sync</h2>
          </div>
          <p className="mt-2 text-sm text-ink/62">
            Subscribe once and let Silbo update the calendar feed when times, TBD teams, or venues change. Calendar apps choose their own refresh timing.
          </p>
        </Link>
        <div className="rounded-xl border border-export/30 bg-export/10 p-4">
          <div className="flex items-center gap-2 text-export">
            <FileImage size={18} />
            <h2 className="font-bold">Static Packs</h2>
          </div>
          <p className="mt-2 text-sm text-ink/62">
            Download images, .ics snapshots, or Notes text without signing up. These are yours to share, but they do not auto-update.
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeading title="Image template" subtitle="Photo export never becomes unreadable - it paginates." />
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
                  {item.label}
                  <span className={`block text-xs font-normal ${template === item.key ? 'text-void/70' : 'text-ink/50'}`}>
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/70">
              {schedule.length} events {'->'} <strong>{pages.length}</strong> page{pages.length === 1 ? '' : 's'} (max{' '}
              {MAX_EVENTS_BY_TEMPLATE[template]} per page)
            </p>
          </Panel>

          <Panel className="space-y-2">
            <PanelHeading title="Export" />
            <Button className="w-full" variant="export" onClick={() => exportImages(true)} disabled={schedule.length === 0}>
              <FileImage size={15} /> Save image{pages.length > 1 ? `s (${pages.length})` : ''}
            </Button>
            <Button className="w-full" variant="ghost" onClick={exportIcs} disabled={schedule.length === 0}>
              <Download size={15} /> Download World Cup .ics
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={exportAllSportsIcs}
              disabled={myEvents.events.length === 0}
              title="Every upcoming event from the leagues and players you follow, across all sports"
            >
              <CalendarDays size={15} /> All-sports calendar .ics{myEvents.events.length ? ` (${myEvents.events.length})` : ''}
            </Button>
            <Button className="w-full" variant="subtle" onClick={copyNotes} disabled={schedule.length === 0}>
              <Copy size={15} /> Copy for Notes
            </Button>
            {message && <p className="text-sm font-medium text-primary">{message}</p>}
          </Panel>
        </div>

        <Panel>
          <PanelHeading
            title="Preview"
            subtitle={`Page 1 of ${pages.length || 1} - ${cityLabel} local time`}
          >
            <Share2 size={18} className="text-primary" />
          </PanelHeading>
          {schedule.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink/50">Follow teams to see an export preview.</p>
          ) : (
            <div className="space-y-2">
              {(pages[0] ?? []).map((match) => (
                <div
                  key={`${match.date}-${match.team1}-${match.team2}`}
                  className="flex flex-col gap-1 rounded-lg bg-page/70 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="font-mono text-xs font-semibold text-primary sm:w-32 sm:shrink-0">
                    {formatDate(match.startsAt, timeZone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })}{' '}
                    {formatTime(match.startsAt, timeZone, { locale: prefs.locale, hour12: prefs.hour12 ?? undefined })}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">
                    {match.team1} vs {match.team2}
                  </span>
                  <span className="hidden truncate text-xs text-ink/50 sm:block">{match.ground}</span>
                </div>
              ))}
              {pages.length > 1 && (
                <p className="pt-1 text-xs text-ink/50">
                  + {schedule.length - (pages[0]?.length ?? 0)} more events on {pages.length - 1} additional page
                  {pages.length > 2 ? 's' : ''}.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
