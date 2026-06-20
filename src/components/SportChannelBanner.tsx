import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { getSport } from '../domain/sports'

type BannerStat = {
  value: string
  label: string
}

type BannerStyle = CSSProperties & Record<`--sport-channel-${string}`, string>

type ArtFocus = {
  iconX: string
  iconY: string
  actionX: string
  actionY: string
}

type SportChannelBannerProps = {
  sportKey: string
  title?: string
  kicker?: string
  body?: string
  ctaLabel?: string
  ctaTo?: string
  stats?: BannerStat[]
}

const assetKeyBySport: Record<string, string> = {
  soccer: 'soccer',
  basketball: 'basketball',
  football: 'football',
  hockey: 'hockey',
  tennis: 'tennis',
  golf: 'golf',
  motorsport: 'motorsport',
  track: 'track',
  combat: 'combat',
  olympic: 'olympic',
  baseball: 'baseball',
  custom: 'custom',
  cricket: 'custom',
  rugby: 'football',
  volleyball: 'basketball',
  handball: 'basketball',
  cycling: 'motorsport',
  snooker: 'custom',
  darts: 'custom',
  nba: 'basketball',
  wnba: 'basketball',
  nfl: 'football',
  cfl: 'football',
  f1: 'motorsport',
  ufc: 'combat',
  mlb: 'baseball',
}

const artFocusByAsset: Record<string, ArtFocus> = {
  soccer: { iconX: '45%', iconY: '38%', actionX: '82%', actionY: '28%' },
  basketball: { iconX: '45%', iconY: '36%', actionX: '58%', actionY: '28%' },
  football: { iconX: '46%', iconY: '42%', actionX: '64%', actionY: '28%' },
  hockey: { iconX: '44%', iconY: '70%', actionX: '34%', actionY: '72%' },
  tennis: { iconX: '75%', iconY: '70%', actionX: '64%', actionY: '34%' },
  golf: { iconX: '52%', iconY: '61%', actionX: '56%', actionY: '42%' },
  motorsport: { iconX: '47%', iconY: '50%', actionX: '65%', actionY: '61%' },
  track: { iconX: '48%', iconY: '46%', actionX: '47%', actionY: '48%' },
  combat: { iconX: '47%', iconY: '50%', actionX: '43%', actionY: '45%' },
  olympic: { iconX: '48%', iconY: '42%', actionX: '50%', actionY: '54%' },
  baseball: { iconX: '50%', iconY: '48%', actionX: '50%', actionY: '48%' },
  custom: { iconX: '50%', iconY: '45%', actionX: '55%', actionY: '45%' },
}

// Program/light action-art mask-size override. Default is `contain` (whole figure, fit to height).
// Portrait scenes (e.g. baseball's batter) end up narrow under `contain`, so they get a height
// scale-up to fill the panel like the near-square scenes do — a slight zoom, scene still reads.
const actionSizeByAsset: Record<string, string> = {
  baseball: 'auto 138%',
}

const defaultStats: BannerStat[] = [
  { value: 'Live', label: 'Review' },
  { value: 'Dates', label: 'Planned' },
  { value: 'Alerts', label: 'Ready' },
  { value: 'Sync', label: 'Ready' },
]

export function SportChannelBanner({
  sportKey,
  title,
  kicker = 'Coverage capsule',
  body,
  ctaLabel = 'Back to sports',
  ctaTo = '/explore',
  stats = defaultStats,
}: SportChannelBannerProps) {
  const { prefs } = useAppState()
  const sport = getSport(sportKey) ?? getSport('soccer')
  const assetKey = assetKeyBySport[sportKey] ?? assetKeyBySport[sport?.key ?? 'soccer'] ?? 'soccer'
  const artFocus = artFocusByAsset[assetKey] ?? artFocusByAsset.soccer
  const channelTitle = title ?? `${sport?.label ?? 'Sports'} Channel`
  const coverageBody =
    body ??
    `${sport?.flagshipLeague ?? 'Live sports'} coverage will light up as soon as schedules are ready. Follow what matters and Silbo keeps it in your timezone.`
  const bannerStyle: BannerStyle =
    prefs.themeMode === 'program'
      ? {
          '--sport-channel-icon': `url("/assets/sport-banners/ink/${assetKey}-icon.webp")`,
          '--sport-channel-action': `url("/assets/sport-banners/ink/${assetKey}-action.webp")`,
          '--sport-channel-icon-wash-x': artFocus.iconX,
          '--sport-channel-icon-wash-y': artFocus.iconY,
          '--sport-channel-action-wash-x': artFocus.actionX,
          '--sport-channel-action-wash-y': artFocus.actionY,
          '--sport-channel-action-size': actionSizeByAsset[assetKey] ?? 'contain',
        }
      : {
          '--sport-channel-icon-image': `url("/assets/sport-banners/broadcast/${assetKey}-icon.webp")`,
          '--sport-channel-action-image': `url("/assets/sport-banners/broadcast/${assetKey}-action.webp")`,
        }

  return (
    <section
      className="sport-channel-banner"
      style={bannerStyle}
    >
      <div className="sport-channel-panel sport-channel-icon-panel" aria-hidden="true" />

      <div className="sport-channel-title">
        <p>{kicker}</p>
        <h1>{channelTitle}</h1>
        <dl className="sport-channel-stats">
          {stats.map((stat) => (
            <div key={`${stat.value}-${stat.label}`}>
              <dt>{stat.value}</dt>
              <dd>{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="sport-channel-copy">
        <p>{coverageBody}</p>
        {ctaTo && (
          <Link to={ctaTo} className="sport-channel-cta">
            {ctaLabel}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>

      <div className="sport-channel-panel sport-channel-action-panel" aria-hidden="true" />
    </section>
  )
}
