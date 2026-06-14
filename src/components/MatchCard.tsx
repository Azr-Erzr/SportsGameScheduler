import { AlertTriangle, Bell, ChevronDown, MapPin, RadioTower, Tv } from 'lucide-react'
import { useState } from 'react'
import type { Match } from '../domain/match'
import { formatDate, formatLongDate, formatTime } from '../lib/time'

// Schedule events render as TICKETS (Channel S rule): cream paper on the broadcast void,
// deep sport-specific time stub with perforated edge, ink type. The on-screen card, the
// poster export, and the share card are deliberately the same object.

export function MatchCard({
  match,
  timeZone,
  conflicted = false,
  highlightTeams = [],
  locale,
  hour12,
}: {
  match: Match
  timeZone: string
  conflicted?: boolean
  highlightTeams?: string[]
  locale?: string
  hour12?: boolean | null
}) {
  const [expanded, setExpanded] = useState(false)
  const title = `${match.team1} vs ${match.team2}`
  const timeOptions = { locale, hour12: hour12 ?? undefined }

  return (
    // PERF: plain article + CSS transitions. Framer `layout` springs on 70+ list items
    // measured the whole list every frame and was the main scroll-jank source.
    <article
      className={`ticket-paper relative overflow-hidden p-0 transition-transform duration-150 hover:-translate-y-0.5 ${
        conflicted ? 'outline outline-2 outline-offset-2 outline-neon-magenta' : ''
      }`}
    >
      {conflicted && (
        <span className="absolute right-3 top-0 z-10 rounded-b-sm bg-neon-magenta px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-void">
          <AlertTriangle size={9} className="mr-1 inline-block" />
          Overlap
        </span>
      )}

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} details for ${title}`}
        className="flex w-full items-stretch text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary max-sm:flex-col"
      >
        {/* Time stub: sport-specific ticket ink, not neon/cyber. */}
        <div
          className="relative flex w-28 shrink-0 flex-col justify-center bg-ticket-stub px-3 py-3 text-center text-ticket-stub-text max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:px-4 sm:border-r-2 sm:border-dashed sm:border-paper/45"
        >
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ticket-stub-text/75">
            {formatDate(match.startsAt, timeZone, timeOptions)}
          </span>
          <strong className="font-head text-base font-black leading-tight text-ticket-stub-text">
            {formatTime(match.startsAt, timeZone, timeOptions)}
          </strong>
        </div>

        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-2 text-base font-bold text-paper-ink">
            <span className={highlightTeams.includes(match.team1) ? 'underline decoration-2 underline-offset-4' : ''}>
              {match.team1}
            </span>
            <em className="font-mono text-[10px] font-semibold not-italic text-paper-ink/40">VS</em>
            <span className={highlightTeams.includes(match.team2) ? 'underline decoration-2 underline-offset-4' : ''}>
              {match.team2}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-paper-ink/55">
            {match.group && <span>{match.group}</span>}
            <span>{match.round}</span>
            <span>{match.ground}</span>
          </div>
        </div>

        <span className="mr-3 mt-3 flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-md bg-paper-ink/8 text-paper-ink/70 max-sm:hidden">
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="mx-4 mb-3 grid animate-[ticket-open_160ms_ease-out] gap-3 border-t border-dashed border-paper-ink/25 pt-3 text-paper-ink md:grid-cols-[1fr_280px]">
          <div className="grid gap-2 text-sm text-paper-ink/70 sm:grid-cols-2">
            <div className="rounded-lg bg-paper-ink/5 p-3">
              <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper-ink">
                <RadioTower size={13} /> Match details
              </p>
              <p className="font-semibold text-paper-ink">{formatLongDate(match.startsAt, timeZone, timeOptions)}</p>
              <p>
                {match.group ? `${match.group} - ` : ''}
                {match.round}
              </p>
            </div>
            <div className="rounded-lg bg-paper-ink/5 p-3">
              <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper-ink">
                <MapPin size={13} /> Venue
              </p>
              <p className="font-semibold text-paper-ink">{match.ground}</p>
              <p>City and broadcast metadata will attach here once provider data is normalized.</p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-paper-ink/30 bg-paper-ink/4 p-3">
            <p className="mb-1 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-paper-ink">
              <Tv size={13} /> Where to watch
            </p>
            <p className="text-sm font-semibold text-paper-ink">Broadcast links coming later</p>
            <p className="mt-1 text-xs text-paper-ink/55">
              This is the future sponsored/provider slot for local TV, streaming, radio, and venue watch-party links.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-paper-ink">
              <Bell size={12} /> Alerts plug in here when times or providers change.
            </p>
          </div>
        </div>
      )}
    </article>
  )
}
