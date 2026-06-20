import { CalendarDays, Copy, Download, FileImage, Share2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppState } from '../app/state-context'
import { cityLabelFor } from '../lib/cities'
import { Button, Panel, PanelHeading } from '../components/ui'
import { filterMatchesForTeams, useMatches } from '../data/liveMatches'
import { useMyEvents } from '../data/liveSport'
import { brand, exportFilename } from '../domain/brand'
import { copyToClipboard, downloadBlob } from '../lib/clipboard'
import { createIcsBlob, createMultiSportIcsBlob } from '../lib/ics'
import { t } from '../lib/i18n'
import { createMultiSportNotesText, createNotesText } from '../lib/notes'
import { MAX_EVENTS_BY_TEMPLATE, paginateEvents, type ExportTemplate } from '../lib/paginate'
import { canvasToBlob, createScheduleCanvas } from '../lib/poster'
import { formatDate, formatTime } from '../lib/time'
import { posterChromeTheme } from '../theme/themes'
import { CalendarFeedsPage } from './CalendarFeeds'

const templates: Array<{ key: ExportTemplate; labelKey: string; hint: string }> = [
  { key: 'story', labelKey: 'export.template.story', hint: '7 events/page' },
  { key: 'poster', labelKey: 'export.template.poster', hint: '9 events/page' },
  { key: 'compact', labelKey: 'export.template.compact', hint: '12 events/page' },
  { key: 'family', labelKey: 'export.template.family', hint: '6 events/page' },
]

type ExportMode = 'static' | 'sync'

export function ExportStudioPage() {
  const { followedTeams, followedLeagueIds, followedCompetitorIds, prefs } = useAppState()
  const [mode, setMode] = useState<ExportMode>('static')
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

  async function copyAllSportsNotes() {
    const text = createMultiSportNotesText(myEvents.events, timeZone, cityLabel, prefs.locale, prefs.hour12)
    if (navigator.share) {
      await navigator.share({ title: brand.scheduleTitle, text })
      setMessage('All-sports text schedule opened in your share sheet.')
      return
    }
    await copyToClipboard(text)
    setMessage(`All-sports text schedule copied - ${myEvents.events.length} events.`)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-primary">{t('export.title', undefined, prefs.locale)}</h1>
        <p className="text-sm text-ink/60">
          {t('export.body', undefined, prefs.locale)}
        </p>
      </div>

      <Panel className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          data-testid="export-mode-sync"
          aria-pressed={mode === 'sync'}
          onClick={() => setMode('sync')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            mode === 'sync'
              ? 'border-primary/50 bg-primary/10'
              : 'border-primary/20 bg-page/60 hover:bg-primary/5'
          }`}
        >
          <div className="flex items-center gap-2 text-primary">
            <CalendarDays size={18} />
            <h2 className="font-bold">{t('export.liveSync', undefined, prefs.locale)}</h2>
          </div>
          <p className="mt-2 text-sm text-ink/62">
            {t('export.liveSyncBody', undefined, prefs.locale)}
          </p>
        </button>
        <button
          type="button"
          data-testid="export-mode-static"
          aria-pressed={mode === 'static'}
          onClick={() => setMode('static')}
          className={`rounded-xl border p-4 text-left transition-colors ${
            mode === 'static'
              ? 'border-export/50 bg-export/10'
              : 'border-export/25 bg-page/60 hover:bg-export/8'
          }`}
        >
          <div className="flex items-center gap-2 text-export">
            <FileImage size={18} />
            <h2 className="font-bold">{t('export.staticPacks', undefined, prefs.locale)}</h2>
          </div>
          <p className="mt-2 text-sm text-ink/62">
            {t('export.staticPacksBody', undefined, prefs.locale)}
          </p>
        </button>
      </Panel>

      {mode === 'sync' ? (
        <CalendarFeedsPage embedded />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Panel>
            <PanelHeading title={t('export.imageTemplate', undefined, prefs.locale)} subtitle={t('export.imageTemplateBody', undefined, prefs.locale)} />
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
                  <span className={`block text-xs font-normal ${template === item.key ? 'text-void/70' : 'text-ink/50'}`}>
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/70">
              {t(
                'export.pageHint',
                {
                  count: schedule.length,
                  pages: pages.length,
                  plural: pages.length === 1 ? '' : 's',
                  max: MAX_EVENTS_BY_TEMPLATE[template],
                },
                prefs.locale,
              )}
            </p>
          </Panel>

          <Panel className="space-y-2">
            <PanelHeading title={t('export.actions', undefined, prefs.locale)} />
            <Button className="w-full" variant="export" onClick={() => exportImages(true)} disabled={schedule.length === 0}>
              <FileImage size={15} />{' '}
              {pages.length > 1
                ? t('export.saveImages', { count: pages.length }, prefs.locale)
                : t('export.saveImage', undefined, prefs.locale)}
            </Button>
            <Button className="w-full" variant="ghost" onClick={exportIcs} disabled={schedule.length === 0}>
              <Download size={15} /> {t('export.downloadWorldCup', undefined, prefs.locale)}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              onClick={exportAllSportsIcs}
              disabled={myEvents.events.length === 0}
              title={t('export.allSportsTitle', undefined, prefs.locale)}
            >
              <CalendarDays size={15} /> {t('export.allSportsCalendar', undefined, prefs.locale)}
              {myEvents.events.length ? ` (${myEvents.events.length})` : ''}
            </Button>
            <Button className="w-full" variant="subtle" onClick={copyNotes} disabled={schedule.length === 0}>
              <Copy size={15} /> {t('export.copyNotes', undefined, prefs.locale)}
            </Button>
            <Button
              className="w-full"
              variant="subtle"
              onClick={copyAllSportsNotes}
              disabled={myEvents.events.length === 0}
              title="Copy followed live sports as plain text"
            >
              <Copy size={15} /> Copy all-sports notes
              {myEvents.events.length ? ` (${myEvents.events.length})` : ''}
            </Button>
            {message && <p className="text-sm font-medium text-primary">{message}</p>}
          </Panel>
        </div>

        <Panel>
          <PanelHeading
            title={t('export.preview', undefined, prefs.locale)}
            subtitle={t('export.previewSubtitle', { pages: pages.length || 1, city: cityLabel }, prefs.locale)}
          >
            <Share2 size={18} className="text-primary" />
          </PanelHeading>
          {schedule.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink/50">{t('export.emptyPreview', undefined, prefs.locale)}</p>
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
      )}
    </div>
  )
}
