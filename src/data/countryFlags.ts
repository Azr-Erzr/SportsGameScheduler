const COUNTRY_FLAG_CODES: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia & Herzegovina': 'ba',
  'Bosnia-Herzegovina': 'ba',
  Brazil: 'br',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Colombia: 'co',
  Croatia: 'hr',
  Curacao: 'cw',
  'Czech Republic': 'cz',
  'DR Congo': 'cd',
  'Congo DR': 'cd',
  DRC: 'cd',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Haiti: 'ht',
  Iran: 'ir',
  Iraq: 'iq',
  'Ivory Coast': 'ci',
  "Cote d'Ivoire": 'ci',
  Japan: 'jp',
  Jordan: 'jo',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Turkey: 'tr',
  Uruguay: 'uy',
  USA: 'us',
  'United States': 'us',
  'United States of America': 'us',
  Uzbekistan: 'uz',
}

function normalizeCountryLabel(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function countryFlagCodeFor(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = normalizeCountryLabel(value)
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toLowerCase()
  if (/^gb-(?:eng|sct|wls|nir)$/i.test(normalized)) return normalized.toLowerCase()

  const titleCase = normalized
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bUsa\b/, 'USA')
    .replace(/\bDr\b/, 'DR')

  return COUNTRY_FLAG_CODES[normalized] ?? COUNTRY_FLAG_CODES[titleCase] ?? null
}
