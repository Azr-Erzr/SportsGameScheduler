import type { CSSProperties, PropsWithChildren } from 'react'
import type { SportTheme } from './themes'

// Projects a SportTheme onto CSS custom properties scoped to a `data-sport` subtree.
// Changing the theme prop reskins everything underneath without touching component code.
//
// Both var sets are required: --mp-* is our stable token contract (used by motifs and
// inline styles), while --color-* must ALSO be overridden here because Tailwind's @theme
// resolves `var(--mp-*)` at :root — where --mp-* is unset — so utilities like bg-page would
// otherwise keep the fallback palette and ignore subtree overrides.
export function SportThemeProvider({ theme, children }: PropsWithChildren<{ theme: SportTheme }>) {
  return (
    <div
      data-sport={theme.key}
      data-paper={theme.mode === 'paper' ? '' : undefined}
      style={
        {
          '--mp-bg': theme.colors.bg,
          '--mp-surface': theme.colors.surface,
          '--mp-text': theme.colors.text,
          '--mp-primary': theme.colors.primary,
          '--mp-secondary': theme.colors.secondary,
          '--mp-accent': theme.colors.accent,
          '--mp-export': theme.colors.export,
          '--mp-ticket-stub': theme.colors.ticketStub,
          '--mp-ticket-stub-text': theme.colors.ticketStubText,
          '--color-page': theme.colors.bg,
          '--color-surface': theme.colors.surface,
          '--color-ink': theme.colors.text,
          '--color-primary': theme.colors.primary,
          '--color-secondary': theme.colors.secondary,
          '--color-accent': theme.colors.accent,
          '--color-export': theme.colors.export,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
