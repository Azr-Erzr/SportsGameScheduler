import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const origin = process.env.SILBO_SEO_ORIGIN ?? 'https://silbosports.com'

const staticRoutes = [
  {
    path: '/',
    title: 'Silbo Sports - every game, in your calendar',
    description:
      'One schedule for every sport you follow. Local times, live calendar feeds, poster exports, and alerts.',
    priority: '1.0',
    changefreq: 'daily',
  },
  {
    path: '/explore',
    title: 'Explore sports schedules - Silbo Sports',
    description: 'Browse soccer, basketball, football, hockey, tennis, golf, motorsport, combat sports, and community schedules.',
    priority: '0.8',
    changefreq: 'weekly',
  },
  {
    path: '/my-schedule',
    title: 'My Schedule - Silbo Sports',
    description: 'Your followed teams, leagues, players, drivers, and fighters in one local-time schedule.',
    priority: '0.6',
    changefreq: 'daily',
  },
  {
    path: '/exports',
    title: 'Schedule exports - Silbo Sports',
    description: 'Export your sports schedule to live calendar feeds, posters, images, and Notes-friendly text.',
    priority: '0.5',
    changefreq: 'monthly',
  },
  {
    path: '/calendar',
    title: 'Live calendar sync - Silbo Sports',
    description: 'Subscribe once and let your sports calendar update when event times change.',
    priority: '0.5',
    changefreq: 'monthly',
  },
  {
    path: '/custom-leagues',
    title: 'Community schedules - Silbo Sports',
    description: 'Create and share local league schedules for families, teams, clubs, and community sports.',
    priority: '0.5',
    changefreq: 'monthly',
  },
]

const sportRoutes = [
  ['soccer', 'Soccer schedule & World Cup live times', 'World Cup, UEFA, EPL, La Liga, and soccer fixtures in your local time.'],
  ['basketball', 'Basketball schedule & live times', 'NBA, WNBA, FIBA, NCAA, and basketball fixtures in your local time.'],
  ['football', 'American football schedule & live times', 'NFL, CFL, NCAA football, playoffs, bowls, and Grey Cup path in your local time.'],
  ['hockey', 'Hockey schedule & live times', 'NHL, PWHL, IIHF, and hockey puck drops in your local time.'],
  ['tennis', 'Tennis schedule & live times', 'ATP, WTA, Grand Slam windows, and tennis matches in your local time.'],
  ['golf', 'Golf schedule & tee times', 'Majors, PGA, LPGA, Ryder Cup, and golf rounds in your local time.'],
  ['motorsport', 'Motorsport schedule & race weekends', 'F1, NASCAR, IndyCar, practice, qualifying, sprint, and race sessions.'],
  ['combat', 'Combat sports schedule & fight cards', 'UFC, PFL, boxing, main cards, prelims, fighters, and late changes.'],
  ['track', 'Track & field schedule', 'World Athletics, Diamond League, trials, heats, finals, and athlete-follow scheduling.'],
  ['olympic', 'Olympic sports schedule', 'Olympics, swimming, gymnastics, medal events, and federation schedule windows.'],
].map(([key, title, description]) => ({
  path: `/sports/${key}`,
  title: `${title} - Silbo Sports`,
  description,
  priority: key === 'soccer' || key === 'basketball' ? '0.9' : '0.8',
  changefreq: 'daily',
}))

function readEnvFile() {
  return fs
    .readFile(path.join(root, '.env'), 'utf8')
    .then((text) => {
      for (const line of text.split(/\r?\n/)) {
        if (!line || line.trimStart().startsWith('#')) continue
        const i = line.indexOf('=')
        if (i === -1) continue
        const key = line.slice(0, i).trim()
        const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
        process.env[key] ??= value
      }
    })
    .catch(() => {})
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function setTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}

function injectMeta(baseHtml, route) {
  const url = `${origin}${route.path === '/' ? '/' : route.path}`
  let html = baseHtml
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeXml(route.title)}</title>`)
  html = setTag(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${escapeXml(route.description)}" />`)
  html = setTag(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${escapeXml(url)}" />`)
  html = setTag(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${escapeXml(url)}" />`)
  html = setTag(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escapeXml(route.title)}" />`)
  html = setTag(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${escapeXml(route.description)}" />`)
  html = setTag(html, /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${escapeXml(route.title)}" />`)
  html = setTag(html, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${escapeXml(route.description)}" />`)
  return html
}

async function writeRouteHtml(baseHtml, route) {
  const html = injectMeta(baseHtml, route)
  const routeDir = route.path === '/' ? distDir : path.join(distDir, route.path.replace(/^\//, ''))
  await fs.mkdir(routeDir, { recursive: true })
  await fs.writeFile(path.join(routeDir, 'index.html'), html)
}

async function fetchDbRoutes() {
  await readEnvFile()
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return []

  const supabase = createClient(url, key)
  const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
  const [eventsRes, leaguesRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, leagues(name), sports(key)')
      .eq('visibility', 'public')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(300),
    supabase
      .from('leagues')
      .select('id, name, sports(key)')
      .eq('is_public', true)
      .order('display_rank', { ascending: true })
      .limit(100),
  ])

  const eventRoutes = (eventsRes.data ?? []).map((event) => ({
    path: `/events/${event.id}`,
    title: `${event.title} - when & where to watch | Silbo Sports`,
    description: `${event.title}${event.leagues?.name ? ` - ${event.leagues.name}` : ''}. Start time, venue, where to watch, follow, and add to calendar.`,
    priority: '0.7',
    changefreq: 'daily',
  }))

  const leagueRoutes = (leaguesRes.data ?? []).map((league) => ({
    path: `/leagues/${league.id}`,
    title: `${league.name} schedule & fixtures - Silbo Sports`,
    description: `${league.name} upcoming fixtures in your local time. Follow the league and sync it to your calendar.`,
    priority: '0.6',
    changefreq: 'daily',
  }))

  return [...leagueRoutes, ...eventRoutes]
}

async function writeSitemap(routes) {
  const urls = routes
    .map(
      (route) =>
        `  <url><loc>${escapeXml(`${origin}${route.path === '/' ? '/' : route.path}`)}</loc><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`,
    )
    .join('\n')
  await fs.writeFile(
    path.join(distDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  )
}

async function writeOgCover() {
  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b0a08"/>
          <stop offset="0.56" stop-color="#16130f"/>
          <stop offset="1" stop-color="#102817"/>
        </linearGradient>
        <radialGradient id="signal" cx="78%" cy="24%" r="65%">
          <stop offset="0" stop-color="#54ff9f" stop-opacity="0.55"/>
          <stop offset="0.42" stop-color="#46e8ff" stop-opacity="0.22"/>
          <stop offset="1" stop-color="#0b0a08" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect width="1200" height="630" fill="url(#signal)"/>
      <g opacity="0.18" stroke="#f4ead8" stroke-width="1">
        ${Array.from({ length: 18 }, (_, i) => `<path d="M0 ${60 + i * 34}H1200"/>`).join('')}
        ${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 52} 0V630"/>`).join('')}
      </g>
      <g transform="translate(78 82)">
        <circle cx="38" cy="38" r="27" fill="none" stroke="#54ff9f" stroke-width="10"/>
        <path d="M66 26c32-22 66-20 94 4" fill="none" stroke="#46e8ff" stroke-width="9" stroke-linecap="round"/>
        <path d="M73 50c25-13 48-12 70 3" fill="none" stroke="#ff4fd8" stroke-width="7" stroke-linecap="round"/>
        <text x="0" y="132" font-family="Arial Black, Arial, sans-serif" font-size="42" fill="#54ff9f" letter-spacing="4">SILBO</text>
      </g>
      <text x="82" y="288" font-family="Arial Black, Arial, sans-serif" font-size="76" fill="#f4ead8">Every game, match,</text>
      <text x="82" y="372" font-family="Arial Black, Arial, sans-serif" font-size="76" fill="#f4ead8">race, and card</text>
      <text x="82" y="458" font-family="Arial Black, Arial, sans-serif" font-size="76" fill="#54ff9f">in your calendar.</text>
      <text x="86" y="535" font-family="Arial, sans-serif" font-size="31" fill="#f4ead8" opacity="0.78">Local times. Live feeds. Poster exports. Alerts.</text>
      <g transform="translate(840 390)" fill="none" stroke="#54ff9f" stroke-width="7" opacity="0.9">
        <circle cx="110" cy="70" r="94"/>
        <path d="M31 21c55 42 105 46 158 0M29 119c58-39 111-38 162 0M110-24c-37 57-37 130 0 188M110-24c37 57 37 130 0 188"/>
      </g>
    </svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  await fs.writeFile(path.join(distDir, 'og-cover.png'), png)
}

const baseHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8')
const dbRoutes = await fetchDbRoutes()
const routes = [...staticRoutes, ...sportRoutes, ...dbRoutes]
await Promise.all(routes.map((route) => writeRouteHtml(baseHtml, route)))
await writeSitemap(routes)
await writeOgCover()
await fs.writeFile(path.join(distDir, '_redirects'), '/*  /index.html  200\n')

console.log(`Generated SEO HTML for ${routes.length} routes, sitemap.xml, og-cover.png, and _redirects.`)
