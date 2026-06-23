import { ExternalLink, Tv } from 'lucide-react'
import { useWatchOptions } from '../data/watchLinks'
import { t } from '../lib/i18n'

type WatchOptionsPanelProps = {
  eventId?: string | null
  leagueId?: string | null
  leagueName?: string | null
  sportKey?: string | null
  regionCode?: string | null
  locale?: string | null
  limit?: number
  compact?: boolean
  /** 'paper' recolors links for cream ticket surfaces (MatchCard) where the neon primary is illegible. */
  variant?: 'default' | 'paper'
}

// Theme-token classes per surface. The default sits on the dark broadcast surface; 'paper' sits on
// the cream ticket and uses ink colors so links stay legible.
const VARIANTS = {
  default: {
    link: 'border-primary/25 bg-primary/8 text-primary hover:border-primary/45 hover:bg-primary/15',
    icon: 'bg-primary text-void',
    note: 'text-ink/40',
  },
  paper: {
    link: 'border-paper-ink/20 bg-paper-ink/[0.06] text-paper-ink hover:border-paper-ink/35 hover:bg-paper-ink/10',
    icon: 'bg-ticket-stub text-ticket-stub-text',
    note: 'text-paper-ink/50',
  },
} as const

export function WatchOptionsPanel({
  eventId,
  leagueId,
  leagueName,
  sportKey,
  regionCode,
  locale,
  limit = 5,
  compact = false,
  variant = 'default',
}: WatchOptionsPanelProps) {
  const region = (regionCode ?? 'US').toUpperCase()
  const { links } = useWatchOptions({ eventId, leagueId, leagueName, sportKey, regionCode: region, limit })
  const anyAffiliate = links.some((l) => l.affiliate)
  const styles = VARIANTS[variant]

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      {!compact && (
        <p className={`text-sm ${variant === 'paper' ? 'text-paper-ink/60' : 'text-ink/55'}`}>
          {t('event.watchNoBroadcast', undefined, locale)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${link.name}-${link.href}`}
            href={link.href}
            target="_blank"
            rel={link.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
            className={`group inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-extrabold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${styles.link}`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${styles.icon}`}>
              <Tv size={13} />
            </span>
            <span className="max-w-[190px] truncate">{link.name}</span>
            <ExternalLink size={13} className="shrink-0 opacity-55 transition-opacity group-hover:opacity-90" />
          </a>
        ))}
      </div>
      <p className={`font-mono text-[10px] uppercase tracking-wide ${styles.note}`}>
        {region} rights - official/direct links - availability varies by listing
      </p>
      {anyAffiliate && (
        <p className={`text-[11px] ${styles.note}`}>
          {t('event.watchAffiliate', undefined, locale)}
        </p>
      )}
    </div>
  )
}
