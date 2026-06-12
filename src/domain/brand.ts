export const brand = {
  appName: 'Silbo Sports',
  legacyName: 'MatchPulse',
  domainHint: 'silbosports.com',
  scheduleTitle: 'Silbo schedule',
  tagline: 'Every game, match, race, and card in your calendar.',
  modules: {
    schedule: 'My Schedule',
    picks: 'Picks',
    sync: 'Sync',
    packs: 'Packs',
    community: 'Community',
  },
} as const

export function exportFilename(base = 'schedule', extension = 'png') {
  return `silbo-${base}.${extension}`
}
