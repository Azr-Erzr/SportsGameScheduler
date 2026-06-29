import type { ReactNode } from 'react'
import { COUNTRY_FLAG_ASSETS } from '../data/countryFlagAssets'
import { countryFlagCodeFor } from '../data/countryFlags'

const SIZE_CLASS = {
  sm: 'h-5 w-7 rounded-[4px]',
  md: 'h-6 w-8 rounded-[5px]',
  lg: 'h-7 w-10 rounded-md',
} as const

export function CountryFlagMark({
  name,
  country,
  selected = false,
  size = 'md',
  className = '',
  fallback,
}: {
  name: string
  country?: string | null
  selected?: boolean
  size?: keyof typeof SIZE_CLASS
  className?: string
  fallback?: ReactNode
}) {
  const code = countryFlagCodeFor(country) ?? countryFlagCodeFor(name)
  const flagSrc = code ? COUNTRY_FLAG_ASSETS[code] : null
  if (!flagSrc) return fallback

  return (
    <span
      title={name}
      className={`country-flag-mark relative inline-flex shrink-0 items-center justify-center overflow-hidden border bg-paper ${
        SIZE_CLASS[size]
      } ${selected ? 'border-primary shadow-[0_0_0_2px_rgba(22,163,74,0.14)]' : 'border-paper-ink/15'} ${className}`}
    >
      <img className="h-full w-full object-cover" src={flagSrc} alt="" aria-hidden="true" loading="lazy" />
      <span className="sr-only">{name}</span>
    </span>
  )
}
