import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { writeBrandAssets } from './generate-brand-assets.mjs'

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

function readWranglerPublicSupabaseEnv() {
  return fs
    .readFile(path.join(root, 'wrangler.jsonc'), 'utf8')
    .then((text) => {
      const valueFor = (key) => {
        const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))
        return match?.[1]
      }

      process.env.VITE_SUPABASE_URL ??= valueFor('VITE_SUPABASE_URL') ?? valueFor('SUPABASE_URL')
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??=
        valueFor('VITE_SUPABASE_PUBLISHABLE_KEY') ??
        valueFor('VITE_SUPABASE_ANON_KEY') ??
        valueFor('SUPABASE_PUBLISHABLE_KEY')
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
  await readWranglerPublicSupabaseEnv()
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

const baseHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8')
const dbRoutes = await fetchDbRoutes()
const routes = [...staticRoutes, ...sportRoutes, ...dbRoutes]
await Promise.all(routes.map((route) => writeRouteHtml(baseHtml, route)))
await writeSitemap(routes)
await writeBrandAssets(distDir, { rootDir: root })

console.log(`Generated SEO HTML for ${routes.length} routes, sitemap.xml, and brand assets.`)
