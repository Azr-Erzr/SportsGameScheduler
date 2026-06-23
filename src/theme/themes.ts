// Sport theme tokens — "Channel S" broadcast model (docs/silbo-design-synthesis.md).
//
// One shared warm-void dark base; each sport changes only its NEON accent pair + motif.
// Neon is for UI; chrome/gold lives in export posters. The paper theme is the light
// "program book" surface used by share pages and print-leaning views.
// Maps onto the --mp-* CSS variables set by SportThemeProvider and consumed by Tailwind
// utilities via src/styles/tailwind.css.

export type SportTheme = {
  key: string
  label: string
  mode: 'broadcast' | 'paper'
  colors: {
    bg: string
    surface: string
    text: string
    primary: string
    secondary: string
    accent: string
    export: string
    ticketStub: string
    ticketStubText: string
  }
  motifs: {
    background: 'pitch' | 'track' | 'ice' | 'court' | 'fairway' | 'rings' | 'neutral'
    cardShape: 'ticket' | 'scoreboard' | 'slab' | 'poster'
  }
}

// Shared broadcast base: warm void (a hair warmer/lighter than pure black, per direction),
// warm panels, cream type, gold export CTAs.
const broadcastBase = {
  bg: '#0b0a08',
  surface: '#16130f',
  text: '#f4ead8',
  secondary: '#f4ead8',
  export: '#ffc24b',
  ticketStubText: '#fff3d7',
}

function broadcast(
  key: string,
  label: string,
  primary: string,
  accent: string,
  motifs: SportTheme['motifs'],
  ticketStub = primary,
): SportTheme {
  return {
    key,
    label,
    mode: 'broadcast',
    colors: { ...broadcastBase, primary, accent, ticketStub },
    motifs,
  }
}

export const neutralTheme = broadcast('neutral', 'All Sports', '#4dff8a', '#46e8ff', {
  background: 'neutral',
  cardShape: 'slab',
})

export const soccerTheme = broadcast('soccer', 'Soccer', '#54ff9f', '#46e8ff', {
  background: 'pitch',
  cardShape: 'ticket',
}, '#0b6f44')

export const basketballTheme = broadcast('basketball', 'Basketball', '#ffa94d', '#ff4fd8', {
  background: 'court',
  cardShape: 'slab',
}, '#9a4f12')

export const footballTheme = broadcast('football', 'American Football', '#ff8a5b', '#ffd34d', {
  background: 'pitch',
  cardShape: 'scoreboard',
}, '#7d2f1f')

export const hockeyTheme = broadcast('hockey', 'Hockey', '#46e8ff', '#9fd8ff', {
  background: 'ice',
  cardShape: 'slab',
}, '#1c5c73')

export const motorsportTheme = broadcast('motorsport', 'Motorsport', '#ff5247', '#ffd34d', {
  background: 'track',
  cardShape: 'scoreboard',
}, '#8f1f1a')

export const tennisTheme = broadcast('tennis', 'Tennis', '#d8ff49', '#54ff9f', {
  background: 'court',
  cardShape: 'ticket',
}, '#5f6f16')

export const golfTheme = broadcast('golf', 'Golf', '#8affc1', '#ffd34d', {
  background: 'fairway',
  cardShape: 'poster',
}, '#2f5a32')

export const combatTheme = broadcast('combat', 'Combat Sports', '#ff4fd8', '#ff6a55', {
  background: 'rings',
  cardShape: 'poster',
}, '#7d1737')

export const trackTheme = broadcast('track', 'Track & Field', '#ffc24b', '#ff5247', {
  background: 'track',
  cardShape: 'scoreboard',
}, '#8f6115')

export const olympicTheme = broadcast('olympic', 'Olympic Sports', '#7aa2ff', '#ffd34d', {
  background: 'rings',
  cardShape: 'poster',
}, '#284f8f')

export const baseballTheme = broadcast('baseball', 'Baseball', '#ff5630', '#ffd34d', {
  background: 'pitch',
  cardShape: 'scoreboard',
}, '#8a2c14')

export const customTheme = broadcast('custom', 'Community', '#b18aff', '#54ff9f', {
  background: 'neutral',
  cardShape: 'slab',
}, '#5b3b8c')

export const wnbaTheme = broadcast('wnba', 'WNBA', '#ff7ab8', '#ffa94d', {
  background: 'court',
  cardShape: 'slab',
}, '#8a315d')

// Chrome-on-paper: the EXPORT POSTER finish (locked decision: neon for UI, chrome for
// export posters). Warm paper field, ink blocks, gold-chrome accents — built for Photos.
export const posterChromeTheme: SportTheme = {
  key: 'poster-chrome',
  label: 'Poster',
  mode: 'paper',
  colors: {
    bg: '#f1e6cf',
    surface: '#fbf5e9',
    text: '#1d1812',
    primary: '#241d15',
    secondary: '#e9b949',
    accent: '#9a6a12',
    export: '#b3541e',
    ticketStub: '#241d15',
    ticketStubText: '#fff3d7',
  },
  motifs: { background: 'neutral', cardShape: 'poster' },
}

// Light "program paper" surface: share pages, print-leaning reading views, export previews.
export const paperTheme: SportTheme = {
  key: 'paper',
  label: 'Program',
  mode: 'paper',
  colors: {
    bg: '#f4ead8',
    surface: '#fbf5e9',
    text: '#1d1812',
    primary: '#155e38',
    secondary: '#1d1812',
    accent: '#b3541e',
    export: '#9a6a12',
    ticketStub: '#155e38',
    ticketStubText: '#fff3d7',
  },
  motifs: { background: 'neutral', cardShape: 'poster' },
}

export const themesByKey: Record<string, SportTheme> = {
  neutral: neutralTheme,
  paper: paperTheme,
  soccer: soccerTheme,
  basketball: basketballTheme,
  football: footballTheme,
  hockey: hockeyTheme,
  motorsport: motorsportTheme,
  tennis: tennisTheme,
  golf: golfTheme,
  combat: combatTheme,
  track: trackTheme,
  olympic: olympicTheme,
  baseball: baseballTheme,
  custom: customTheme,
  cricket: customTheme,
  rugby: footballTheme,
  volleyball: basketballTheme,
  handball: basketballTheme,
  cycling: motorsportTheme,
  snooker: customTheme,
  darts: customTheme,
  esports: customTheme,
  // Route/league aliases.
  f1: motorsportTheme,
  nhl: hockeyTheme,
  nba: basketballTheme,
  wnba: wnbaTheme,
  ufc: combatTheme,
  cfl: footballTheme,
  mlb: baseballTheme,
}

export function getTheme(key: string): SportTheme {
  return themesByKey[key] ?? soccerTheme
}

const programPrimary: Record<string, string> = {
  neutral: '#155e38',
  soccer: '#155e38',
  basketball: '#9a4f12',
  football: '#8f3a21',
  hockey: '#1f5f78',
  motorsport: '#99251f',
  tennis: '#566815',
  golf: '#275c38',
  combat: '#7d1737',
  track: '#8a5a12',
  olympic: '#284f8f',
  baseball: '#9a3a1a',
  cricket: '#5b3b8c',
  rugby: '#8f3a21',
  volleyball: '#9a4f12',
  handball: '#9a4f12',
  cycling: '#99251f',
  snooker: '#5b3b8c',
  darts: '#5b3b8c',
  custom: '#5b3b8c',
  wnba: '#8a315d',
}

export function withSurfaceMode(theme: SportTheme, mode: 'broadcast' | 'program'): SportTheme {
  if (mode === 'broadcast') return theme
  const primary = programPrimary[theme.key] ?? theme.colors.ticketStub
  return {
    ...theme,
    mode: 'paper',
    colors: {
      ...theme.colors,
      bg: '#f4ead8',
      surface: '#fbf5e9',
      text: '#1d1812',
      primary,
      secondary: '#1d1812',
      accent: theme.colors.ticketStub,
      export: '#b3541e',
      ticketStub: primary,
      ticketStubText: '#fff3d7',
    },
  }
}
