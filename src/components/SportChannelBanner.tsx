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
  custom: 'custom',
  nba: 'basketball',
  wnba: 'basketball',
  nfl: 'football',
  cfl: 'football',
  f1: 'motorsport',
  ufc: 'combat',
}

const defaultStats: BannerStat[] = [
  { value: 'API', label: 'Review' },
  { value: 'Feeds', label: 'Planned' },
  { value: 'Alerts', label: 'Ready' },
  { value: 'Sync', label: 'Ready' },
]

export function SportChannelBanner({
  sportKey,
  title,
  kicker = 'Source testing capsule',
  body,
  ctaLabel = 'Back to sports',
  ctaTo = '/explore',
  stats = defaultStats,
}: SportChannelBannerProps) {
  const { prefs } = useAppState()
  const sport = getSport(sportKey) ?? getSport('soccer')
  const assetKey = assetKeyBySport[sportKey] ?? assetKeyBySport[sport?.key ?? 'soccer'] ?? 'soccer'
  const channelTitle = title ?? `${sport?.label ?? 'Sports'} Channel`
  const sourceBody =
    body ??
    `${sport?.flagshipLeague ?? 'Live sports'} will light up as soon as licensed schedule data is connected. ${
      sport?.sourceNote ?? 'Provider coverage is being reviewed.'
    }`
  const bannerStyle: BannerStyle =
    prefs.themeMode === 'program'
      ? {
          '--sport-channel-icon': `url("/assets/sport-banners/ink/${assetKey}-icon.png")`,
          '--sport-channel-action': `url("/assets/sport-banners/ink/${assetKey}-action.png")`,
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
        <p>{sourceBody}</p>
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
