import { ExternalLink, Tv } from 'lucide-react'
import { useWatchOptions, type WatchOption } from '../data/watchLinks'

type WatchProviderBadgesProps = {
  eventId?: string | null
  leagueId?: string | null
  leagueName?: string | null
  sportKey?: string | null
  regionCode?: string | null
  limit?: number
  maxVisible?: number
  variant?: 'paper' | 'dark'
  className?: string
}

type BadgeStyle = {
  label: string
  className: string
}

const STYLE_RULES: Array<{ pattern: RegExp; style: BadgeStyle }> = [
  { pattern: /fox/i, style: { label: 'FOX', className: 'border-[#244a8f]/35 bg-[#244a8f] text-white' } },
  { pattern: /telemundo/i, style: { label: 'TEL', className: 'border-[#e41f35]/35 bg-[#e41f35] text-white' } },
  { pattern: /tsn|ctv|rds/i, style: { label: 'TSN', className: 'border-[#d71920]/35 bg-[#d71920] text-white' } },
  { pattern: /espn/i, style: { label: 'ESPN', className: 'border-[#cc0000]/35 bg-[#cc0000] text-white' } },
  { pattern: /dazn/i, style: { label: 'DAZN', className: 'border-paper-ink/35 bg-paper-ink text-paper' } },
  { pattern: /fubo/i, style: { label: 'FUBO', className: 'border-[#fb5a1d]/35 bg-[#fb5a1d] text-white' } },
  { pattern: /sling/i, style: { label: 'SLING', className: 'border-[#00a7e1]/35 bg-[#00a7e1] text-void' } },
  { pattern: /peacock/i, style: { label: 'PEA', className: 'border-[#5b2d90]/35 bg-[#5b2d90] text-white' } },
  { pattern: /paramount/i, style: { label: 'P+', className: 'border-[#0064ff]/35 bg-[#0064ff] text-white' } },
  { pattern: /prime/i, style: { label: 'PRIME', className: 'border-[#00a8e1]/35 bg-[#00a8e1] text-void' } },
  { pattern: /sky/i, style: { label: 'SKY', className: 'border-[#0072ce]/35 bg-[#0072ce] text-white' } },
  { pattern: /nbc/i, style: { label: 'NBC', className: 'border-[#4b4bb7]/35 bg-[#4b4bb7] text-white' } },
  { pattern: /tnt|max/i, style: { label: 'TNT', className: 'border-[#111827]/35 bg-[#111827] text-white' } },
  { pattern: /sportsnet/i, style: { label: 'SN+', className: 'border-[#005dab]/35 bg-[#005dab] text-white' } },
  { pattern: /bbc/i, style: { label: 'BBC', className: 'border-paper-ink/35 bg-paper-ink text-paper' } },
  { pattern: /itv/i, style: { label: 'ITV', className: 'border-[#00a6a6]/35 bg-[#00a6a6] text-void' } },
  { pattern: /nba/i, style: { label: 'NBA', className: 'border-[#17408b]/35 bg-[#17408b] text-white' } },
  { pattern: /mlb/i, style: { label: 'MLB', className: 'border-[#002d72]/35 bg-[#002d72] text-white' } },
  { pattern: /formula|f1/i, style: { label: 'F1', className: 'border-[#e10600]/35 bg-[#e10600] text-white' } },
  { pattern: /wimbledon/i, style: { label: 'WIM', className: 'border-[#006b54]/35 bg-[#006b54] text-white' } },
]

const FALLBACK_STYLE: BadgeStyle = {
  label: 'WATCH',
  className: 'border-ticket-stub/40 bg-ticket-stub text-ticket-stub-text',
}

function compactLabel(link: WatchOption) {
  const haystack = `${link.key} ${link.name}`
  const match = STYLE_RULES.find((rule) => rule.pattern.test(haystack))
  if (match) return match.style

  const words = link.name
    .replace(/\([^)]*\)/g, '')
    .split(/[\s/+.-]+/)
    .filter(Boolean)
  const label = words.length === 1
    ? words[0].slice(0, 5).toUpperCase()
    : words.slice(0, 2).map((word) => word[0]).join('').slice(0, 4).toUpperCase()
  return { ...FALLBACK_STYLE, label: label || FALLBACK_STYLE.label }
}

export function WatchProviderBadges({
  eventId,
  leagueId,
  leagueName,
  sportKey,
  regionCode,
  limit = 4,
  maxVisible = 2,
  variant = 'paper',
  className = '',
}: WatchProviderBadgesProps) {
  const region = (regionCode ?? 'US').toUpperCase()
  const { links } = useWatchOptions({ eventId, leagueId, leagueName, sportKey, regionCode: region, limit })
  const visible = links.slice(0, maxVisible)
  const extra = Math.max(0, links.length - visible.length)
  const iconClass = variant === 'paper' ? 'text-paper-ink/45' : 'text-ink/45'
  const extraClass = variant === 'paper'
    ? 'border-paper-ink/15 bg-paper-ink/5 text-paper-ink/55'
    : 'border-primary/20 bg-primary/8 text-ink/55'

  if (!visible.length) return null

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`} aria-label={`Where to watch in ${region}`}>
      <Tv size={13} className={`shrink-0 ${iconClass}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {visible.map((link) => {
          const style = compactLabel(link)
          return (
            <a
              key={`${link.name}-${link.href}`}
              href={link.href}
              target="_blank"
              rel={link.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
              title={`Watch on ${link.name}`}
              onClick={(event) => event.stopPropagation()}
              className={`inline-flex h-7 min-w-10 items-center justify-center rounded-md border px-2 font-mono text-[10px] font-black uppercase leading-none tracking-wide shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${style.className}`}
            >
              <span>{style.label}</span>
              <ExternalLink size={10} className="ml-1 opacity-70" aria-hidden="true" />
            </a>
          )
        })}
        {extra > 0 && (
          <span className={`inline-flex h-7 items-center rounded-md border px-2 font-mono text-[10px] font-black ${extraClass}`}>
            +{extra}
          </span>
        )}
      </div>
    </div>
  )
}
