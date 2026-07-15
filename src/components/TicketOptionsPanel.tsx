import { ExternalLink, Ticket } from 'lucide-react'
import { ticketOptionsFor } from '../data/ticketLinks'

type TicketOptionsPanelProps = {
  title: string
  leagueName?: string | null
  venue?: string | null
  regionCode?: string | null
  eventId?: string | null
  placement?: string | null
  ticketmasterUrl?: string | null
  limit?: number
  compact?: boolean
}

const BADGE_STYLES: Record<string, { label: string; className: string }> = {
  ticketmaster: { label: 'TM', className: 'ticket-provider-badge ticket-provider-ticketmaster border-[#026cdf]/35 bg-[#026cdf] text-white' },
  stubhub: { label: 'STUB', className: 'ticket-provider-badge ticket-provider-stubhub border-[#3f2b96]/35 bg-[#3f2b96] text-white' },
  seatgeek: { label: 'SG', className: 'ticket-provider-badge ticket-provider-seatgeek border-[#00b050]/35 bg-[#00b050] text-white' },
  vivid_seats: { label: 'VIV', className: 'ticket-provider-badge ticket-provider-vivid border-[#e11d48]/35 bg-[#e11d48] text-white' },
}

export function TicketOptionsPanel({
  title,
  leagueName,
  venue,
  regionCode,
  eventId,
  placement,
  ticketmasterUrl,
  limit = 4,
  compact = false,
}: TicketOptionsPanelProps) {
  const region = (regionCode ?? 'US').toUpperCase()
  const links = ticketOptionsFor({
    title,
    leagueName,
    venue,
    regionCode: region,
    eventId,
    placement,
    ticketmasterUrl,
    limit,
  })
  const anyAffiliate = links.some((link) => link.affiliate)
  if (!links.length) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {!compact && (
        <p className="text-sm text-ink/55">
          Search primary and resale ticket marketplaces. Listings, fees, and availability vary by provider.
        </p>
      )}
      {anyAffiliate && (
        <p className="rounded-md border border-ticket-stub/30 bg-ticket-stub/10 px-2.5 py-2 text-xs leading-relaxed text-ink/65">
          <strong className="text-ink">Paid links:</strong> Silbo Sports may earn a commission if you buy through a marked
          link, at no extra cost to you.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const style = BADGE_STYLES[link.key] ?? { label: 'TIX', className: 'border-primary/35 bg-primary text-void' }
          return (
            <a
              key={`${link.key}-${link.href}`}
              href={link.href}
              target="_blank"
              rel={link.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
              className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm font-extrabold text-primary shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className={`flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-[10px] font-black ${style.className}`}>
                {style.label}
              </span>
              <span className="max-w-[170px] truncate">{link.name}</span>
              {link.affiliate && (
                <span className="rounded bg-ticket-stub/15 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-ink/65">
                  Paid link
                </span>
              )}
              <ExternalLink size={13} className="shrink-0 opacity-55 transition-opacity group-hover:opacity-90" />
            </a>
          )
        })}
      </div>
      <p className="flex items-start gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ink/40">
        <Ticket size={12} className="mt-0.5 shrink-0" />
        {region} ticket search - {anyAffiliate ? 'paid links marked' : 'direct links'} - no guaranteed inventory
      </p>
    </div>
  )
}
