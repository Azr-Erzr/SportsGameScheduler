export type LocaleCode = 'en' | 'fr' | 'es' | 'pt'

type Messages = Record<string, string>

const english: Messages = {
  'nav.home': 'Home',
  'nav.mySchedule': 'My Schedule',
  'nav.explore': 'Sports',
  'nav.calendar': 'Sync',
  'nav.exports': 'Exports',
  'nav.customLeagues': 'Community',
  'home.headline': 'One schedule for every sport you follow.',
  'home.body':
    'Choose your teams, countries, players, drivers, fighters, leagues, and tournaments. Silbo Sports combines their upcoming events in your local time, then makes the schedule easy to save, share, or sync.',
  'home.searchPlaceholder': 'Search a team, country, player, driver, fighter, league, or tournament',
  'home.buildSchedule': 'Build my schedule',
  'home.exploreSports': 'Browse sports',
  'home.createCustomLeague': 'Create custom league',
  'home.spotlightTitle': 'Biggest coming up',
  'home.spotlightSubtitle': 'A rotating view of sports moments worth tracking over the next six weeks.',
  'home.exportTitle': 'Save it your way',
  'home.customTitle': 'Running a local league?',
}

export const localeOptions: Array<{ code: LocaleCode; label: string; shortLabel: string }> = [
  { code: 'en', label: 'English', shortLabel: 'EN' },
  { code: 'fr', label: 'Francais', shortLabel: 'FR' },
  { code: 'es', label: 'Espanol', shortLabel: 'ES' },
  { code: 'pt', label: 'Portugues', shortLabel: 'PT' },
]

export const regionOptions = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'PT', label: 'Portugal' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
]

const messages: Record<LocaleCode, Messages> = {
  en: english,
  fr: {
    ...english,
    'nav.home': 'Accueil',
    'home.headline': 'Un seul calendrier pour tous les sports que vous suivez.',
  },
  es: {
    ...english,
    'nav.home': 'Inicio',
    'home.headline': 'Un calendario para todos los deportes que sigues.',
  },
  pt: {
    ...english,
    'nav.home': 'Inicio',
    'home.headline': 'Uma agenda para todos os esportes que voce acompanha.',
  },
}

export function normalizeLocale(locale?: string | null): LocaleCode {
  const base = locale?.split('-')[0]?.toLowerCase()
  return base === 'fr' || base === 'es' || base === 'pt' ? base : 'en'
}

export function t(key: string, params?: Record<string, string | number>, locale?: string | null) {
  const table = messages[normalizeLocale(locale)]
  let value = table[key] ?? english[key] ?? key
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(replacement))
    }
  }
  return value
}

export function associationFootballLabel(locale?: string | null, regionCode?: string | null) {
  const localeCode = normalizeLocale(locale)
  if (localeCode === 'es') return 'Futbol'
  if (localeCode === 'pt') return 'Futebol'
  if (localeCode === 'fr') return 'Football'
  if (regionCode === 'GB' || regionCode === 'IE') return 'Football'
  return 'Soccer'
}
