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
    'nav.mySchedule': 'Mon programme',
    'nav.explore': 'Sports',
    'nav.calendar': 'Sync',
    'nav.exports': 'Exports',
    'nav.customLeagues': 'Communauté',
    'home.headline': 'Un seul calendrier pour tous les sports que vous suivez.',
    'home.body':
      'Choisissez vos équipes, pays, joueurs, pilotes, combattants, ligues et tournois. Silbo Sports réunit leurs prochains événements à votre heure locale, prêts à enregistrer, partager ou synchroniser.',
    'home.searchPlaceholder': 'Cherchez une équipe, un pays, un joueur, un pilote, une ligue ou un tournoi',
    'home.buildSchedule': 'Créer mon programme',
    'home.exploreSports': 'Parcourir les sports',
    'home.createCustomLeague': 'Créer une ligue',
    'home.spotlightTitle': 'À venir',
    'home.spotlightSubtitle': 'Une sélection des grands moments du sport sur les six prochaines semaines.',
    'home.exportTitle': 'Exportez à votre façon',
    'home.customTitle': 'Vous gérez une ligue locale ?',
  },
  es: {
    ...english,
    'nav.home': 'Inicio',
    'nav.mySchedule': 'Mi agenda',
    'nav.explore': 'Deportes',
    'nav.calendar': 'Sync',
    'nav.exports': 'Exportar',
    'nav.customLeagues': 'Comunidad',
    'home.headline': 'Un calendario para todos los deportes que sigues.',
    'home.body':
      'Elige tus equipos, países, jugadores, pilotos, luchadores, ligas y torneos. Silbo Sports reúne sus próximos eventos en tu hora local y los deja listos para guardar, compartir o sincronizar.',
    'home.searchPlaceholder': 'Busca un equipo, país, jugador, piloto, liga o torneo',
    'home.buildSchedule': 'Crear mi agenda',
    'home.exploreSports': 'Explorar deportes',
    'home.createCustomLeague': 'Crear una liga',
    'home.spotlightTitle': 'Lo más próximo',
    'home.spotlightSubtitle': 'Una selección de los grandes momentos del deporte en las próximas seis semanas.',
    'home.exportTitle': 'Expórtalo a tu manera',
    'home.customTitle': '¿Organizas una liga local?',
  },
  pt: {
    ...english,
    'nav.home': 'Início',
    'nav.mySchedule': 'Minha agenda',
    'nav.explore': 'Esportes',
    'nav.calendar': 'Sync',
    'nav.exports': 'Exportar',
    'nav.customLeagues': 'Comunidade',
    'home.headline': 'Uma agenda para todos os esportes que você acompanha.',
    'home.body':
      'Escolha seus times, países, jogadores, pilotos, lutadores, ligas e torneios. O Silbo Sports reúne os próximos eventos no seu horário local, prontos para salvar, compartilhar ou sincronizar.',
    'home.searchPlaceholder': 'Busque um time, país, jogador, piloto, liga ou torneio',
    'home.buildSchedule': 'Montar minha agenda',
    'home.exploreSports': 'Explorar esportes',
    'home.createCustomLeague': 'Criar uma liga',
    'home.spotlightTitle': 'Em breve',
    'home.spotlightSubtitle': 'Uma seleção dos grandes momentos do esporte nas próximas seis semanas.',
    'home.exportTitle': 'Exporte do seu jeito',
    'home.customTitle': 'Organiza uma liga local?',
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
