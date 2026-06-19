export type FlagColorStop = {
  color: string
  weight?: number
}

export type FlagColorPalette = {
  name: string
  colors: FlagColorStop[]
}

// National-team selector colors. These are visual palettes from the real flags, not kit colors.
// Weight is only for the selector pole gradient; it keeps dominant flag fields recognizable.
export const flagColorCatalog: Record<string, FlagColorPalette> = {
  Algeria: {
    name: 'Algeria',
    colors: [
      { color: '#006633', weight: 2 },
      { color: '#ffffff', weight: 2 },
      { color: '#d21034', weight: 1 },
    ],
  },
  Argentina: {
    name: 'Argentina',
    colors: [
      { color: '#75aadb', weight: 2 },
      { color: '#ffffff', weight: 2 },
      { color: '#f6b40e', weight: 1 },
    ],
  },
  Australia: {
    name: 'Australia',
    colors: [
      { color: '#012169', weight: 3 },
      { color: '#ffffff', weight: 1 },
      { color: '#c8102e', weight: 1 },
    ],
  },
  Austria: {
    name: 'Austria',
    colors: [
      { color: '#ed2939', weight: 2 },
      { color: '#ffffff', weight: 1 },
      { color: '#ed2939', weight: 2 },
    ],
  },
  Belgium: {
    name: 'Belgium',
    colors: [
      { color: '#000000', weight: 1 },
      { color: '#ffd90c', weight: 1 },
      { color: '#ef3340', weight: 1 },
    ],
  },
  'Bosnia & Herzegovina': {
    name: 'Bosnia & Herzegovina',
    colors: [
      { color: '#002f6c', weight: 3 },
      { color: '#ffcd00', weight: 1 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Brazil: {
    name: 'Brazil',
    colors: [
      { color: '#009b3a', weight: 3 },
      { color: '#ffdf00', weight: 2 },
      { color: '#002776', weight: 1 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Canada: {
    name: 'Canada',
    colors: [
      { color: '#ff0000', weight: 2 },
      { color: '#ffffff', weight: 1 },
      { color: '#ff0000', weight: 2 },
    ],
  },
  'Cape Verde': {
    name: 'Cape Verde',
    colors: [
      { color: '#003893', weight: 4 },
      { color: '#ffffff', weight: 1 },
      { color: '#cf2027', weight: 1 },
      { color: '#f7d116', weight: 1 },
    ],
  },
  Colombia: {
    name: 'Colombia',
    colors: [
      { color: '#fcd116', weight: 2 },
      { color: '#003893', weight: 1 },
      { color: '#ce1126', weight: 1 },
    ],
  },
  Croatia: {
    name: 'Croatia',
    colors: [
      { color: '#ff0000', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#171796', weight: 1 },
    ],
  },
  'Czech Republic': {
    name: 'Czech Republic',
    colors: [
      { color: '#ffffff', weight: 1 },
      { color: '#d7141a', weight: 1 },
      { color: '#11457e', weight: 1 },
    ],
  },
  'Curaçao': {
    name: 'Curacao',
    colors: [
      { color: '#002b7f', weight: 4 },
      { color: '#f9e814', weight: 1 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  'DR Congo': {
    name: 'DR Congo',
    colors: [
      { color: '#007fff', weight: 3 },
      { color: '#f7d618', weight: 1 },
      { color: '#ce1021', weight: 1 },
    ],
  },
  Ecuador: {
    name: 'Ecuador',
    colors: [
      { color: '#ffdd00', weight: 2 },
      { color: '#034ea2', weight: 1 },
      { color: '#ed1c24', weight: 1 },
    ],
  },
  Egypt: {
    name: 'Egypt',
    colors: [
      { color: '#ce1126', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#000000', weight: 1 },
      { color: '#c09300', weight: 1 },
    ],
  },
  England: {
    name: 'England',
    colors: [
      { color: '#ffffff', weight: 3 },
      { color: '#cf142b', weight: 1 },
    ],
  },
  France: {
    name: 'France',
    colors: [
      { color: '#0055a4', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#ef4135', weight: 1 },
    ],
  },
  Germany: {
    name: 'Germany',
    colors: [
      { color: '#000000', weight: 1 },
      { color: '#dd0000', weight: 1 },
      { color: '#ffce00', weight: 1 },
    ],
  },
  Ghana: {
    name: 'Ghana',
    colors: [
      { color: '#ce1126', weight: 1 },
      { color: '#fcd116', weight: 1 },
      { color: '#006b3f', weight: 1 },
      { color: '#000000', weight: 1 },
    ],
  },
  Haiti: {
    name: 'Haiti',
    colors: [
      { color: '#00209f', weight: 2 },
      { color: '#d21034', weight: 2 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Iran: {
    name: 'Iran',
    colors: [
      { color: '#239f40', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#da0000', weight: 1 },
    ],
  },
  Iraq: {
    name: 'Iraq',
    colors: [
      { color: '#ce1126', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#000000', weight: 1 },
      { color: '#007a3d', weight: 1 },
    ],
  },
  'Ivory Coast': {
    name: 'Ivory Coast',
    colors: [
      { color: '#f77f00', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#009e60', weight: 1 },
    ],
  },
  Japan: {
    name: 'Japan',
    colors: [
      { color: '#ffffff', weight: 3 },
      { color: '#bc002d', weight: 1 },
    ],
  },
  Jordan: {
    name: 'Jordan',
    colors: [
      { color: '#000000', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#007a3d', weight: 1 },
      { color: '#ce1126', weight: 1 },
    ],
  },
  Mexico: {
    name: 'Mexico',
    colors: [
      { color: '#006847', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#ce1126', weight: 1 },
    ],
  },
  Morocco: {
    name: 'Morocco',
    colors: [
      { color: '#c1272d', weight: 4 },
      { color: '#006233', weight: 1 },
    ],
  },
  Netherlands: {
    name: 'Netherlands',
    colors: [
      { color: '#ae1c28', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#21468b', weight: 1 },
      { color: '#ff7f00', weight: 1 },
    ],
  },
  'New Zealand': {
    name: 'New Zealand',
    colors: [
      { color: '#00247d', weight: 3 },
      { color: '#cc142b', weight: 1 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Norway: {
    name: 'Norway',
    colors: [
      { color: '#ba0c2f', weight: 2 },
      { color: '#ffffff', weight: 1 },
      { color: '#00205b', weight: 1 },
    ],
  },
  Panama: {
    name: 'Panama',
    colors: [
      { color: '#ffffff', weight: 2 },
      { color: '#005293', weight: 1 },
      { color: '#d21034', weight: 1 },
    ],
  },
  Paraguay: {
    name: 'Paraguay',
    colors: [
      { color: '#d52b1e', weight: 1 },
      { color: '#ffffff', weight: 1 },
      { color: '#0038a8', weight: 1 },
    ],
  },
  Portugal: {
    name: 'Portugal',
    colors: [
      { color: '#006600', weight: 1 },
      { color: '#ff0000', weight: 2 },
      { color: '#ffcc00', weight: 1 },
    ],
  },
  Qatar: {
    name: 'Qatar',
    colors: [
      { color: '#8a1538', weight: 4 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  'Saudi Arabia': {
    name: 'Saudi Arabia',
    colors: [
      { color: '#006c35', weight: 4 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Scotland: {
    name: 'Scotland',
    colors: [
      { color: '#005eb8', weight: 3 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Senegal: {
    name: 'Senegal',
    colors: [
      { color: '#00853f', weight: 1 },
      { color: '#fdef42', weight: 1 },
      { color: '#e31b23', weight: 1 },
    ],
  },
  'South Africa': {
    name: 'South Africa',
    colors: [
      { color: '#007a4d', weight: 2 },
      { color: '#ffb612', weight: 1 },
      { color: '#000000', weight: 1 },
      { color: '#de3831', weight: 1 },
      { color: '#002395', weight: 1 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  'South Korea': {
    name: 'South Korea',
    colors: [
      { color: '#ffffff', weight: 3 },
      { color: '#c60c30', weight: 1 },
      { color: '#003478', weight: 1 },
      { color: '#000000', weight: 1 },
    ],
  },
  Spain: {
    name: 'Spain',
    colors: [
      { color: '#aa151b', weight: 2 },
      { color: '#f1bf00', weight: 2 },
      { color: '#aa151b', weight: 2 },
    ],
  },
  Sweden: {
    name: 'Sweden',
    colors: [
      { color: '#006aa7', weight: 3 },
      { color: '#fecc00', weight: 1 },
    ],
  },
  Switzerland: {
    name: 'Switzerland',
    colors: [
      { color: '#ff0000', weight: 4 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Tunisia: {
    name: 'Tunisia',
    colors: [
      { color: '#e70013', weight: 4 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Turkey: {
    name: 'Turkey',
    colors: [
      { color: '#e30a17', weight: 4 },
      { color: '#ffffff', weight: 1 },
    ],
  },
  Uruguay: {
    name: 'Uruguay',
    colors: [
      { color: '#ffffff', weight: 3 },
      { color: '#0038a8', weight: 2 },
      { color: '#fcd116', weight: 1 },
    ],
  },
  USA: {
    name: 'USA',
    colors: [
      { color: '#b31942', weight: 2 },
      { color: '#ffffff', weight: 2 },
      { color: '#0a3161', weight: 1 },
    ],
  },
  Uzbekistan: {
    name: 'Uzbekistan',
    colors: [
      { color: '#0099b5', weight: 2 },
      { color: '#ffffff', weight: 1 },
      { color: '#1eb53a', weight: 1 },
      { color: '#ce1126', weight: 1 },
    ],
  },
}

const aliases: Record<string, string> = {
  Curacao: 'Curaçao',
  "Cote d'Ivoire": 'Ivory Coast',
  'Côte d’Ivoire': 'Ivory Coast',
  'Congo DR': 'DR Congo',
  DRC: 'DR Congo',
  'United States': 'USA',
  'United States of America': 'USA',
}

function normalizedTeamName(team: string) {
  return aliases[team] ?? team
}

export function flagPaletteForTeam(team: string): FlagColorPalette | null {
  return flagColorCatalog[normalizedTeamName(team)] ?? null
}

export function flagPoleGradient(team: string) {
  const palette = flagPaletteForTeam(team)
  if (!palette) return 'linear-gradient(180deg, var(--mp-primary), var(--mp-accent))'

  const stops = palette.colors.flatMap((stop) => Array.from({ length: Math.max(1, stop.weight ?? 1) }, () => stop.color))
  const segment = 100 / stops.length
  const parts = stops.map((color, index) => {
    const start = Math.round(index * segment * 100) / 100
    const end = Math.round((index + 1) * segment * 100) / 100
    return `${color} ${start}% ${end}%`
  })

  return `linear-gradient(180deg, ${parts.join(', ')})`
}
