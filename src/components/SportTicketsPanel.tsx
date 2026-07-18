import { ArrowUpRight, Ticket, Tv } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ticketSearchForSport } from '../data/sportTicketSearches'
import type { SportInfo } from '../domain/sports'
import { TicketOptionsPanel } from './TicketOptionsPanel'
import { WatchOptionsPanel } from './WatchOptionsPanel'
import { Panel, PanelHeading } from './ui'

type SportTicketsPanelProps = {
  sport: SportInfo
  regionCode?: string | null
  placement: string
  className?: string
}

export function SportTicketsPanel({ sport, regionCode, placement, className }: SportTicketsPanelProps) {
  const search = ticketSearchForSport(sport)

  return (
    <Panel className={`border-primary/20 bg-surface/85 ${className ?? ''}`}>
      <PanelHeading title={search.title} subtitle="General ticket search">
        <Ticket size={18} className="text-primary" />
      </PanelHeading>
      <p className="mb-3 text-sm leading-relaxed text-ink/62">{search.body}</p>
      <TicketOptionsPanel
        title={search.searchTitle}
        regionCode={regionCode}
        placement={placement}
        limit={4}
        compact
      />
    </Panel>
  )
}

type SportWatchTicketsPanelProps = SportTicketsPanelProps & {
  watchTitle: string
  watchSubtitle?: string
  leagueName?: string | null
  sportKey?: string | null
  broadcastRegionCode?: string | null
  locale?: string | null
}

export function SportWatchTicketsPanel({
  sport,
  regionCode,
  broadcastRegionCode,
  placement,
  className,
  watchTitle,
  watchSubtitle = 'Official broadcaster routes',
  leagueName,
  sportKey,
  locale,
}: SportWatchTicketsPanelProps) {
  const search = ticketSearchForSport(sport)

  return (
    <Panel className={`border-primary/20 bg-surface/85 ${className ?? ''}`}>
      <PanelHeading title="Watch and tickets" subtitle="Broadcast links and ticket searches in one place">
        <div className="flex items-center gap-1 text-primary">
          <Tv size={17} />
          <Ticket size={17} />
        </div>
      </PanelHeading>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-primary/15 bg-page/45 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Where to watch</p>
              <p className="mt-1 text-sm text-ink/60">{watchTitle}</p>
              {watchSubtitle && <p className="mt-0.5 text-xs text-ink/45">{watchSubtitle}</p>}
            </div>
            <Tv size={17} className="shrink-0 text-primary" />
          </div>
          <WatchOptionsPanel
            leagueName={leagueName}
            sportKey={sportKey ?? sport.key}
            regionCode={broadcastRegionCode ?? regionCode}
            locale={locale}
            limit={3}
            compact
          />
        </section>

        <section className="rounded-xl border border-primary/15 bg-page/45 p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Tickets</p>
              <p className="mt-1 text-sm text-ink/60">{search.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink/45">{search.body}</p>
            </div>
            <Ticket size={17} className="shrink-0 text-primary" />
          </div>
          <TicketOptionsPanel
            title={search.searchTitle}
            regionCode={regionCode}
            placement={placement}
            limit={3}
            compact
          />
        </section>
      </div>
    </Panel>
  )
}

type HomeSportTicketsProps = {
  sports: SportInfo[]
  regionCode?: string | null
}

export function HomeSportTickets({ sports, regionCode }: HomeSportTicketsProps) {
  return (
    <section aria-labelledby="home-sport-tickets-title" className="space-y-3" data-home-section="tickets">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="board-label flex items-center gap-2 text-neon-magenta">
            <Ticket size={13} /> Tickets
          </p>
          <h2 id="home-sport-tickets-title" className="mt-2 text-2xl font-black text-primary sm:text-3xl">
            Shop tickets by sport
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/62">
            Browse broad ticket searches for major sports, then use event pages for matchup-specific links when fixtures are live.
          </p>
        </div>
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-bold text-primary">
          Explore sports <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="rounded-card border border-primary/15 bg-surface p-4 shadow-sm sm:hidden">
        <p className="text-sm leading-relaxed text-ink/62">
          Ticket links sit on each sport page, so the home screen stays quick and the context stays right.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {sports.map((sport) => (
            <Link
              key={sport.key}
              to={`/sports/${sport.key}`}
              className="inline-flex items-center justify-between rounded-lg border border-primary/20 bg-page/55 px-3 py-2 text-sm font-bold text-primary"
            >
              {sport.label}
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      </div>

      <div className="hidden gap-3 sm:grid md:grid-cols-2 xl:grid-cols-4">
        {sports.map((sport) => {
          const search = ticketSearchForSport(sport)
          return (
            <article key={sport.key} className="rounded-card border border-primary/15 bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">{sport.label}</p>
                  <h3 className="mt-1 text-base font-black text-primary">{search.title}</h3>
                </div>
                <Link
                  to={`/sports/${sport.key}`}
                  aria-label={`Open ${sport.label} schedule`}
                  className="silbo-opaque-primary-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-void"
                >
                  <ArrowUpRight size={15} />
                </Link>
              </div>
              <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-ink/60">{search.body}</p>
              <TicketOptionsPanel
                title={search.searchTitle}
                regionCode={regionCode}
                placement={`web-home-${sport.key}-tickets`}
                limit={2}
                compact
              />
            </article>
          )
        })}
      </div>
    </section>
  )
}
