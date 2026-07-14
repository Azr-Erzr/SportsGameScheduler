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
    robots: 'noindex, follow',
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
    robots: 'noindex, follow',
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
  {
    path: '/blog',
    title: 'Silbo Sports blog - schedules, where to watch, and what is coming up',
    description:
      'News and explainers on the leagues, teams, and events you follow, each linking to the local-time schedule and where to watch on Silbo Sports.',
    priority: '0.6',
    changefreq: 'daily',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy - Silbo Sports',
    description:
      'How Silbo Sports handles account details, schedules, alerts, cookies, advertising consent, and your privacy choices.',
    priority: '0.3',
    changefreq: 'monthly',
  },
  {
    path: '/terms',
    title: 'Terms of Service - Silbo Sports',
    description:
      'The terms for using Silbo Sports schedules, calendar exports, reminders, community leagues, and third-party links.',
    priority: '0.3',
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

const SPORT_TIMING_MINUTES = {
  soccer: 115,
  basketball: 140,
  american_football: 195,
  hockey: 150,
  baseball: 165,
  tennis: 150,
  golf: 300,
  motorsport: 120,
  combat_sports: 300,
  athletics: 150,
  olympic_sports: 150,
  cricket: 210,
  rugby: 105,
  volleyball: 110,
  handball: 80,
  cycling: 300,
  snooker: 180,
  darts: 120,
  esports: 120,
}

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

function paragraphsHtml(paragraphs) {
  return paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join('')
}

function staticPageBody(routePath, blogBody = '') {
  const bodies = {
    '/': ssrSection(
      'Silbo Sports - every game, in your calendar',
      paragraphsHtml([
        'Silbo Sports brings fixtures from the teams, leagues, tournaments, races, and fight cards you follow into one personal schedule. Every start time is converted to your local timezone, with calendar sync, reminders, exports, and regional where-to-watch links.',
        'The service covers soccer, basketball, American football, hockey, baseball, tennis, golf, motorsport, combat sports, athletics, Olympic sports, cricket, rugby, cycling, and esports. Schedules are best-effort and should be confirmed with an official source before travel or purchases.',
      ]) +
        '<p><a href="/explore">Explore sports schedules</a> | <a href="/how-it-works">How Silbo Sports works</a> | <a href="/about">About Silbo Sports</a></p>',
    ),
    '/explore': ssrSection(
      'Explore sports schedules',
      paragraphsHtml([
        'Browse upcoming events by sport, then follow the competitions and teams you care about. Silbo Sports converts each published start time to your local timezone and lets you add fixtures to your calendar or set a reminder.',
      ]) +
        `<ul>${sportRoutes.map((route) => `<li><a href="${escapeXml(route.path)}">${escapeXml(route.title.replace(' - Silbo Sports', ''))}</a></li>`).join('')}</ul>`,
    ),
    '/calendar': ssrSection(
      'Live sports calendar sync',
      paragraphsHtml([
        'A Silbo calendar subscription is a private feed of the teams and leagues you follow. Add it once to Apple Calendar, Google Calendar, Outlook, or another calendar app and future schedule changes can update the same entries instead of requiring a new download.',
        'You choose what appears in the feed and can revoke or regenerate its private address from Silbo Sports. For a single fixture, use the one-time calendar download on that event page instead.',
      ]) + '<p><a href="/how-it-works">Read how schedule sync works</a></p>',
    ),
    '/about': ssrSection(
      'About Silbo Sports',
      '<h2>Why we built it</h2>' +
        paragraphsHtml([
          'Following more than one sport means juggling schedules published on different sites, in different formats and timezones. Silbo Sports removes that arithmetic by assembling the events you choose into one local-time schedule.',
          'Follow teams, leagues, players, drivers, fighters, and tournaments across sports. You can sync upcoming events to a calendar, export a schedule, share it, or receive an optional reminder before the start.',
        ]) +
        '<h2>Coverage and accuracy</h2>' +
        paragraphsHtml([
          'Silbo covers major professional, international, college, federation, and community sports. Times, venues, and broadcast details are aggregated from public or licensed third-party sources and may change, so important travel and purchase decisions should be confirmed with the official organizer.',
          'Silbo Sports is free. Advertising loads only after advertising consent, affiliate destinations are labelled, and paid ads are kept off community and custom-league surfaces.',
        ]),
    ),
    '/how-it-works': ssrSection(
      'How Silbo Sports works',
      '<h2>1. Follow what you care about</h2>' +
        paragraphsHtml(['Choose teams, leagues, players, drivers, fighters, or tournaments across multiple sports. An account is optional; signing in syncs your choices across devices.']) +
        '<h2>2. See every start in your local timezone</h2>' +
        paragraphsHtml(['Silbo converts each published kickoff, tip-off, first pitch, race start, and fight card to your selected timezone. Event pages also show available venue and regional broadcast information.']) +
        '<h2>3. Sync, export, or get reminded</h2>' +
        paragraphsHtml(['Download one event, subscribe to a private updating calendar feed, export a schedule as an image or text, or opt into an email or push reminder.']) +
        '<p><a href="/explore">Explore sports schedules</a> | <a href="/faq">Read common questions</a></p>',
    ),
    '/faq': ssrSection(
      'Silbo Sports frequently asked questions',
      '<h2>Is Silbo Sports free?</h2><p>Yes. The service is supported by consent-gated advertising and clearly labelled affiliate links.</p>' +
        '<h2>Do I need an account?</h2><p>No. Your choices can stay in your browser; signing in adds cross-device sync and optional alerts.</p>' +
        '<h2>How accurate are schedules?</h2><p>Schedules are best-effort and may change. Confirm important details with the official league, team, venue, or broadcaster.</p>' +
        '<h2>How does calendar sync work?</h2><p>A private subscription feed can update existing calendar entries when a published time changes. One-time downloads do not update automatically.</p>' +
        '<h2>What data is collected?</h2><p>Without an account, preferences stay in local browser storage. Signed-in accounts store the information needed to sync follows and deliver alerts you request. Advertising cookies do not load before consent.</p>' +
        '<p><a href="/privacy">Read the Privacy Policy</a> | <a href="/about">About Silbo Sports</a></p>',
    ),
    '/privacy': ssrSection(
      'Silbo Sports Privacy Policy',
      paragraphsHtml([
        'You can use Silbo Sports without an account, in which case follows and display preferences stay in your browser. If you sign in, Silbo stores your email, follows, preferences, calendar-feed settings, and alerts needed to provide the features you request.',
        'Silbo Sports does not sell personal data. Advertising technology is not loaded until advertising consent is given. Google AdSense and other disclosed service providers may process identifiers according to their own policies when their features are enabled.',
        'You can decline advertising cookies and continue using the service. Account data and private calendar-feed access can be managed from the account page. Privacy questions can be sent to privacy@silbosports.com.',
      ]),
    ),
    '/terms': ssrSection(
      'Silbo Sports Terms of Service',
      paragraphsHtml([
        'Silbo Sports provides schedules, timezone conversion, calendar exports, reminders, and third-party destination links on a best-effort basis. Event times, venues, participants, and broadcast availability can change without notice and should be confirmed with the official source before travel or purchases.',
        'Users are responsible for content they publish through community league features and must have permission to share it. Silbo may remove unlawful, abusive, misleading, or privacy-invasive content and may suspend access that harms the service or other users.',
        'Third-party broadcaster, ticket, and affiliate links are provided for convenience. Their services, availability, prices, and policies are controlled by those third parties. Questions can be sent to privacy@silbosports.com.',
      ]),
    ),
  }

  if (routePath === '/blog') {
    return ssrSection(
      'Silbo Sports articles and schedule explainers',
      paragraphsHtml([
        'Original Silbo Sports articles explain major schedule releases, local start times, calendar planning, and where-to-watch details. Each article is reviewed before publication and links back to the relevant live schedule.',
      ]) + (blogBody || '<p>New articles are being prepared.</p>'),
    )
  }
  return bodies[routePath] ?? null
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

function escapeJsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function setTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`)
}

function injectJsonLd(html, id, data) {
  if (!data) return html
  return html.replace('</head>', `    <script type="application/ld+json" id="${escapeXml(id)}">${escapeJsonScript(data)}</script>\n  </head>`)
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
  if (route.robots) {
    html = setTag(html, /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/, `<meta name="robots" content="${escapeXml(route.robots)}" />`)
  }
  return html
}

function injectBody(html, bodyHtml) {
  if (!bodyHtml) return html
  // Match the SPA mount point regardless of minor attribute spacing.
  return html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${bodyHtml}</div>`)
}

async function writeRouteHtml(baseHtml, route) {
  let html = injectMeta(baseHtml, route)
  if (route.jsonLd) html = injectJsonLd(html, route.jsonLdId ?? `jsonld-${route.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`, route.jsonLd)
  if (route.bodyHtml) html = injectBody(html, route.bodyHtml)
  const routeDir = route.path === '/' ? distDir : path.join(distDir, route.path.replace(/^\//, ''))
  await fs.mkdir(routeDir, { recursive: true })
  await fs.writeFile(path.join(routeDir, 'index.html'), html)
}

function eventStatusUrl(status) {
  if (status === 'cancelled') return 'https://schema.org/EventCancelled'
  if (status === 'postponed') return 'https://schema.org/EventPostponed'
  return 'https://schema.org/EventScheduled'
}

function performerType(kind) {
  return kind === 'person' ? 'Person' : 'PerformingGroup'
}

function inferredMatchPerformers(title) {
  const names = title
    .split(/\s+(?:vs\.?|versus|v\.?)\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length !== 2 || names.some((name) => /^(?:tbd|tbc|unknown)$/i.test(name))) return []
  return names.map((name) => ({ '@type': 'PerformingGroup', name }))
}

function eventStructuredData(event, performers) {
  if (!event.starts_at) return null
  const start = new Date(event.starts_at)
  if (Number.isNaN(start.getTime())) return null
  const url = `${origin}/events/${event.id}`
  const sportKey = event.sports?.key
  const end = new Date(start.getTime() + (SPORT_TIMING_MINUTES[sportKey] ?? 120) * 60_000)
  const explicitPerformers = (performers ?? [])
    .filter((competitor) => competitor.name)
    .map((competitor) => ({ '@type': performerType(competitor.kind), name: competitor.name }))
  const mappedPerformers = explicitPerformers.length ? explicitPerformers : inferredMatchPerformers(event.title)
  const venue = event.venues
  // A SportsEvent is physical: it needs a real Place location. If we have no venue/city/country we
  // can't emit a valid one — skip the JSON-LD entirely (a page with no rich result beats an invalid
  // one that Google flags). Attendance mode is always Offline; never VirtualLocation/Mixed for sports.
  const location =
    venue?.name || venue?.city || venue?.country
      ? {
          '@type': 'Place',
          name: venue.name || venue.city || event.leagues?.name || 'Venue to be confirmed',
          address:
            venue.city || venue.country
              ? {
                  '@type': 'PostalAddress',
                  ...(venue.city ? { addressLocality: venue.city } : {}),
                  ...(venue.country ? { addressCountry: venue.country } : {}),
                }
              : venue.name,
        }
      : null
  if (!location || !mappedPerformers.length) return null
  const descriptionParts = [
    event.title,
    event.leagues?.name ? `in ${event.leagues.name}` : null,
    venue?.name ? `at ${venue.name}` : null,
  ].filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    description: `${descriptionParts.join(' ')}. See the start time in your local timezone, find where to watch, and add it to your calendar with Silbo Sports.`,
    image: [`${origin}/og-cover.png`],
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    performer: mappedPerformers,
    competitor: mappedPerformers,
    organizer: {
      '@type': 'Organization',
      name: event.leagues?.name || 'Silbo Sports',
      url: event.league_id ? `${origin}/leagues/${event.league_id}` : origin,
    },
    offers: {
      '@type': 'Offer',
      name: 'Free Silbo Sports schedule page',
      url,
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: new Date(0).toISOString(),
    },
    url,
  }
}

async function fetchDbRoutes() {
  await readEnvFile()
  await readWranglerPublicSupabaseEnv()
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return { routes: [], sportBodies: new Map(), blogBody: '' }

  const supabase = createClient(url, key)
  const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
  const [eventsRes, leaguesRes, teamsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, starts_at_tbd, status, kind, league_id, leagues(name), sports(key), venues(name, city, country)')
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
  const performersByEvent = new Map()
  for (let i = 0; i < eventIds.length; i += 200) {
    const linkRes = await supabase
      .from('event_competitors')
      .select('event_id, competitor_id, competitors(name, kind)')
      .in('event_id', eventIds.slice(i, i + 200))
    for (const link of linkRes.data ?? []) {
      if (link.competitor_id) teamsWithUpcoming.add(link.competitor_id)
      if (link.event_id && link.competitors?.name) {
        const list = performersByEvent.get(link.event_id) ?? []
        list.push({ name: link.competitors.name, kind: link.competitors.kind })
        performersByEvent.set(link.event_id, list)
      }
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
    jsonLdId: 'jsonld-event',
    jsonLd: eventStructuredData(event, performersByEvent.get(event.id) ?? []),
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

  // Published blog posts. Same-domain articles that link back to schedule pages — list them so they
  // get crawled. Best-effort: skipped silently if the table isn't present yet.
  const { data: blogData } = await supabase
    .from('blog_posts')
    .select('slug, seo_description, dek, updated_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(500)
  const blogRoutes = (blogData ?? []).map((post) => ({
    path: `/blog/${post.slug}`,
    title: `Silbo Sports blog`,
    description: post.seo_description ?? post.dek ?? 'A Silbo Sports article.',
    priority: '0.6',
    changefreq: 'monthly',
  }))

  const blogBody = blogRoutes.length
    ? `<ul>${blogRoutes.map((route) => `<li><a href="${escapeXml(route.path)}">${escapeXml(route.description)}</a></li>`).join('')}</ul>`
    : ''

  return { routes: [...leagueRoutes, ...eventRoutes, ...teamRoutes, ...blogRoutes], sportBodies, blogBody }
}

async function writeSitemap(routes) {
  const urls = routes
    .filter((route) => !route.robots?.includes('noindex'))
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
const { routes: dbRoutes, sportBodies, blogBody } = await fetchDbRoutes()

// Attach the live fixture body to each static /sports shell (the path the Worker serves on error).
const sportRoutesWithBodies = sportRoutes.map((route) => {
  const routeKey = route.path.replace('/sports/', '')
  const inner = sportBodies.get(SPORT_CANONICAL[routeKey])
  return inner ? { ...route, bodyHtml: ssrSection(route.title.replace(' - Silbo Sports', ''), inner) } : route
})

const staticRoutesWithBodies = staticRoutes.map((route) => ({
  ...route,
  bodyHtml: staticPageBody(route.path, blogBody),
}))

const routes = [...staticRoutesWithBodies, ...sportRoutesWithBodies, ...dbRoutes]
await Promise.all(routes.map((route) => writeRouteHtml(baseHtml, route)))
await writeSitemap(routes)
await writeBrandAssets(distDir, { rootDir: root })

console.log(`Generated SEO HTML for ${routes.length} routes, sitemap.xml, and brand assets.`)
