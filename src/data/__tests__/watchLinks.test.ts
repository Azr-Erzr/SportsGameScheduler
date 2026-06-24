import { describe, expect, it } from 'vitest'
import { fallbackWatchOptions } from '../watchLinks'

// The where-to-watch boxes resolve league-specific official rights via CATALOG_RULES
// (docs/where-to-watch-rights-truth.md). These assert the documented broadcaster shows up for the
// right league + region, and that an unmatched query still falls back to something (never empty).
function names(regionCode: string, sportKey: string, leagueName?: string) {
  return fallbackWatchOptions(regionCode, sportKey, 6, leagueName).map((o) => o.name)
}

describe('fallbackWatchOptions league-specific rights', () => {
  it('English Premier League maps to NBC (US) and Sky (UK)', () => {
    expect(names('US', 'soccer', 'Premier League')).toContain('NBC Sports')
    expect(names('GB', 'soccer', 'Premier League')).toContain('Sky Sports')
  })

  it('UEFA Champions League maps to Paramount+ (US) and DAZN (CA)', () => {
    expect(names('US', 'soccer', 'UEFA Champions League')).toContain('Paramount+')
    expect(names('CA', 'soccer', 'UEFA Champions League')).toContain('DAZN')
  })

  it('Formula 1 maps to Apple TV (US 2026) and Sky F1 (UK)', () => {
    expect(names('US', 'motorsport', 'Formula 1')).toContain('Apple TV')
    expect(names('GB', 'motorsport', 'Formula 1')).toContain('Sky Sports F1')
  })

  it('NBA maps to NBA League Pass', () => {
    expect(names('US', 'basketball', 'NBA')).toContain('NBA League Pass')
  })

  it('every resolved link is a real https destination', () => {
    for (const option of fallbackWatchOptions('US', 'soccer', 6, 'Premier League')) {
      expect(option.href).toMatch(/^https:\/\//)
    }
  })

  it('an unmatched league still returns non-empty regional fallback', () => {
    expect(names('US', 'soccer', 'Some Obscure League').length).toBeGreaterThan(0)
  })
})
