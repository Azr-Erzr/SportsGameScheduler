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
  {
    path: '/about',
    title: 'About Silbo Sports - one schedule for every sport you follow',
    description:
      'What Silbo Sports is, why we built it, which sports it covers, and how a free multi-sport schedule that converts every start time to your local zone works.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/how-it-works',
    title: 'How Silbo Sports works - follow, convert, sync',
    description:
      'Follow the teams and leagues you care about, see every start time in your local zone, then sync to your calendar, export, or get reminders.',
    priority: '0.6',
    changefreq: 'monthly',
  },
  {
    path: '/faq',
    title: 'Silbo Sports FAQ - schedules, sync, accounts, and data',
    description:
      'Answers about Silbo Sports: whether it is free, which sports it covers, how start times are converted, how calendar sync and reminders work, and how your data is handled.',
    priority: '0.6',
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

// Route sport key → backend canonical key (public.sports.key). Mirrors the worker's table; kept
// inline so this build step has no dependency on the React/icon bundle.
const SPORT_CANONICAL = {
  soccer: 'soccer',
  basketball: 'basketball',
  football: 'american_football',
  hockey: 'hockey',
  tennis: 'tennis',
  golf: 'golf',
  motorsport: 'motorsport',
  combat: 'combat_sports',
  track: 'athletics',
  olympic: 'olympic_sports',
}

const LOCAL_TIME_NOTE =
  'Silbo Sports shows each start time converted to your local timezone, lists where to watch, and lets you add fixtures to your calendar or get a reminder before kickoff.'

function formatWhenUtc(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date)
}

function fixtureListHtml(events) {
  if (!events.length) {
    return '<p>No upcoming fixtures are scheduled right now — new dates sync in automatically as they are published.</p>'
  }
  const items = events
    .slice(0, 25)
    .map((e) => {
      const when = formatWhenUtc(e.starts_at)
      const time = when
        ? ` — <time datetime="${escapeXml(e.starts_at)}">${escapeXml(when)}</time>`
        : ' — start time to be confirmed'
      const venue = e.venues?.name ? ` · ${escapeXml(e.venues.name)}` : ''
      return `<li><a href="/events/${escapeXml(e.id)}">${escapeXml(e.title)}</a>${time}${venue}</li>`
    })
    .join('')
  return `<ul>${items}</ul>`
}

function leagueLinksHtml(events) {
  const seen = new Map()
  for (const e of events) {
    if (e.league_id && e.leagues?.name && !seen.has(e.league_id)) seen.set(e.league_id, e.leagues.name)
  }
  if (!seen.size) return ''
  const links = [...seen.entries()]
    .map(([id, name]) => `<li><a href="/leagues/${escapeXml(id)}">${escapeXml(name)} schedule</a></li>`)
    .join('')
  return `<p>Browse competitions:</p><ul>${links}</ul>`
}

// Crawler-visible, visually-hidden summary injected into #root. React's createRoot().render()
// replaces #root on mount, so JS users never see it — same progressive-enhancement contract the
// Worker uses for the live entity routes.
function ssrSection(heading, innerHtml) {
  return (
    `<section data-ssr-summary style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">` +
    `<h1>${escapeXml(heading)}</h1>${innerHtml}</section>`
  )
}

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

function injectBody(html, bodyHtml) {
  if (!bodyHtml) return html
  // Match the SPA mount point regardless of minor attribute spacing.
  return html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${bodyHtml}</div>`)
}

async function writeRouteHtml(baseHtml, route) {
  let html = injectMeta(baseHtml, route)
  if (route.bodyHtml) html = injectBody(html, route.bodyHtml)
  const routeDir = route.path === '/' ? distDir : path.join(distDir, route.path.replace(/^\//, ''))
  await fs.mkdir(routeDir, { recursive: true })
  await fs.writeFile(path.join(routeDir, 'index.html'), html)
}

async function fetchDbRoutes() {
  await readEnvFile()
  await readWranglerPublicSupabaseEnv()
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return { routes: [], sportBodies: new Map() }

  const supabase = createClient(url, key)
  const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
  const [eventsRes, leaguesRes, teamsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, league_id, leagues(name), sports(key), venues(name)')
      .eq('visibility', 'public')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(600),
    supabase
      .from('leagues')
      .select('id, name, sports(key)')
      .eq('is_public', true)
      .order('display_rank', { ascending: true })
      .limit(100),
    // Teams are emitted ONLY when they have an upcoming fixture (filtered below). A page that
    // renders "no upcoming events" is thin content at scale — AdSense flagged exactly this — and the
    // Worker now noindexes those anyway, so listing them in the sitemap just wastes crawl budget.
    supabase
      .from('competitors')
      .select('id, name, leagues!inner(name, is_public)')
      .eq('kind', 'team')
      .eq('leagues.is_public', true)
      .order('name')
      .limit(2000),
  ])

  const events = eventsRes.data ?? []

  // Competitor ids that appear in an upcoming public fixture → the only team pages worth indexing.
  const eventIds = events.map((e) => e.id).filter(Boolean)
  const teamsWithUpcoming = new Set()
  for (let i = 0; i < eventIds.length; i += 200) {
    const linkRes = await supabase
      .from('event_competitors')
      .select('competitor_id')
      .in('event_id', eventIds.slice(i, i + 200))
    for (const link of linkRes.data ?? []) {
      if (link.competitor_id) teamsWithUpcoming.add(link.competitor_id)
    }
  }
  // Group fixtures by sport (for the static /sports body) and by league (for the static /leagues body).
  const bySport = new Map()
  const byLeague = new Map()
  for (const e of events) {
    const sportKey = e.sports?.key
    if (sportKey) {
      const list = bySport.get(sportKey) ?? []
      list.push(e)
      bySport.set(sportKey, list)
    }
    if (e.league_id) {
      const list = byLeague.get(e.league_id) ?? []
      list.push(e)
      byLeague.set(e.league_id, list)
    }
  }

  // Inner HTML (heading added per-route in main) keyed by canonical sport key.
  const sportBodies = new Map()
  for (const [sportKey, evs] of bySport) {
    sportBodies.set(sportKey, leagueLinksHtml(evs) + fixtureListHtml(evs) + `<p>${escapeXml(LOCAL_TIME_NOTE)}</p>`)
  }

  const eventRoutes = events.map((event) => ({
    path: `/events/${event.id}`,
    title: `${event.title} - when & where to watch | Silbo Sports`,
    description: `${event.title}${event.leagues?.name ? ` - ${event.leagues.name}` : ''}. Start time, venue, where to watch, follow, and add to calendar.`,
    priority: '0.7',
    changefreq: 'daily',
  }))

  // Only leagues with at least one upcoming fixture are indexable (the Worker noindexes empty ones).
  const leagueRoutes = (leaguesRes.data ?? [])
    .filter((league) => (byLeague.get(league.id)?.length ?? 0) > 0)
    .map((league) => ({
      path: `/leagues/${league.id}`,
      title: `${league.name} schedule & fixtures - Silbo Sports`,
      description: `${league.name} upcoming fixtures in your local time. Follow the league and sync it to your calendar.`,
      priority: '0.6',
      changefreq: 'daily',
      bodyHtml: ssrSection(
        `${league.name} schedule & fixtures`,
        fixtureListHtml(byLeague.get(league.id) ?? []) + `<p>${escapeXml(LOCAL_TIME_NOTE)}</p>`,
      ),
    }))

  const teamRoutes = (teamsRes.data ?? [])
    .filter((team) => team?.name && teamsWithUpcoming.has(team.id))
    .map((team) => ({
      path: `/teams/${team.id}`,
      title: `${team.name} schedule & fixtures - Silbo Sports`,
      description: `${team.name} upcoming fixtures in your local time. Follow ${team.name} and sync every game to your calendar with Silbo Sports.`,
      priority: '0.5',
      changefreq: 'daily',
      bodyHtml: ssrSection(
        `${team.name} schedule`,
        `<p>${escapeXml(`${team.name} upcoming fixtures and start times.`)}</p>` +
          (team.leagues?.name ? `<p>${escapeXml(`Competes in ${team.leagues.name}.`)}</p>` : '') +
          `<p>${escapeXml(LOCAL_TIME_NOTE)}</p>`,
      ),
    }))

  return { routes: [...leagueRoutes, ...eventRoutes, ...teamRoutes], sportBodies }
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
const { routes: dbRoutes, sportBodies } = await fetchDbRoutes()

// Attach the live fixture body to each static /sports shell (the path the Worker serves on error).
const sportRoutesWithBodies = sportRoutes.map((route) => {
  const routeKey = route.path.replace('/sports/', '')
  const inner = sportBodies.get(SPORT_CANONICAL[routeKey])
  return inner ? { ...route, bodyHtml: ssrSection(route.title.replace(' - Silbo Sports', ''), inner) } : route
})

const routes = [...staticRoutes, ...sportRoutesWithBodies, ...dbRoutes]
await Promise.all(routes.map((route) => writeRouteHtml(baseHtml, route)))
await writeSitemap(routes)
await writeBrandAssets(distDir, { rootDir: root })

console.log(`Generated SEO HTML for ${routes.length} routes, sitemap.xml, and brand assets.`)
