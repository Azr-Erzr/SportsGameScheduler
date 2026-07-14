// Edge Worker for Silbo Sports.
//
// The site is a client-rendered SPA served from Cloudflare static assets. Modern crawlers run JS
// and pick up the per-route <head> set in src/lib/seo.ts, but social/link scrapers (Facebook, X,
// iMessage, WhatsApp, Slack) and most AI/answer crawlers do NOT run JS — they only see the static
// index.html, so every shared link historically unfurled as the generic homepage card and gave
// AI engines no citable facts. That kills the most viral surface during a tournament (links
// dropped in group chats) and starves answer engines of schedule data.
//
// This Worker runs first for every request so HTTP and www variants can be redirected to the one
// canonical HTTPS host. For entity routes it fetches the static shell, looks the
// entity up in Supabase, rewrites title/description/canonical/OG/Twitter, and injects a plain-text
// fixture list (matches, local-time note, where-to-watch, add-to-calendar) plus sport→league→team
// →event internal links into the body. React replaces #root on hydration, so real users never see
// duplicated content (progressive enhancement, not cloaking). Finished/past events are marked
// noindex so dead fixtures don't rot in the index. Every other path is served as a fast static
// asset, untouched. Any error falls through to the unmodified asset response, so the SPA can never
// be taken down by this code.

interface Env {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> }
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
}

// Minimal ambient declaration so this file is self-contained without @cloudflare/workers-types.
// HTMLRewriter is a global provided by the Workers runtime.
interface HTMLRewriterInstance {
  on(selector: string, handlers: unknown): HTMLRewriterInstance
  transform(response: Response): Response
}
declare const HTMLRewriter: { new (): HTMLRewriterInstance }

const ORIGIN = 'https://silbosports.com'
const OG_IMAGE = `${ORIGIN}/og-cover.png`

// Silbo converts every time to the visitor's zone client-side; the crawlable copy is rendered in
// UTC (formatWhen appends "UTC") so the fact is unambiguous for engines reading the static shell.
const LOCAL_TIME_NOTE =
  'Silbo Sports shows each start time converted to your local timezone, lists where to watch, and lets you add fixtures to your calendar or get a reminder before kickoff.'

type Meta = {
  title: string
  description: string
  canonical: string
  /** First-paint body summary for no-JS crawlers; React replaces #root on hydration. */
  heading: string
  summaryHtml: string
  jsonLd?: Record<string, unknown>
  /** Past/finished entities set this so the URL drops out of the index without breaking humans. */
  noindex?: boolean
}

const SPORT_TIMING_MINUTES: Record<string, number> = {
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

// Route sport key → backend canonical key + display copy. Mirrors src/domain/sports.ts but kept
// inline so the Worker stays dependency-free (it can't import the React bundle). Keys here are the
// URL segments used in /sports/:key; `canonical` is what public.sports.key stores.
const SPORTS: Record<string, { canonical: string; label: string; flagship: string }> = {
  soccer: { canonical: 'soccer', label: 'Soccer', flagship: 'World Cup, UEFA, EPL, La Liga' },
  basketball: { canonical: 'basketball', label: 'Basketball', flagship: 'NBA, WNBA, FIBA, NCAA' },
  football: { canonical: 'american_football', label: 'American Football', flagship: 'NFL, CFL, NCAA' },
  hockey: { canonical: 'hockey', label: 'Hockey', flagship: 'NHL, PWHL, IIHF' },
  tennis: { canonical: 'tennis', label: 'Tennis', flagship: 'ATP, WTA, Grand Slams' },
  golf: { canonical: 'golf', label: 'Golf', flagship: 'Majors, PGA, LPGA, Ryder Cup' },
  motorsport: { canonical: 'motorsport', label: 'Motorsport', flagship: 'F1, NASCAR, IndyCar' },
  combat: { canonical: 'combat_sports', label: 'Combat Sports', flagship: 'UFC, PFL, Boxing' },
  track: { canonical: 'athletics', label: 'Track & Field', flagship: 'World Athletics, Diamond League' },
  olympic: { canonical: 'olympic_sports', label: 'Olympic Sports', flagship: 'Olympics, Swimming, Gymnastics' },
  baseball: { canonical: 'baseball', label: 'Baseball', flagship: 'MLB, NPB, KBO, NCAA' },
  cricket: { canonical: 'cricket', label: 'Cricket', flagship: 'IPL, Big Bash, World Cups' },
  rugby: { canonical: 'rugby', label: 'Rugby', flagship: 'Six Nations, Rugby World Cup' },
  volleyball: { canonical: 'volleyball', label: 'Volleyball', flagship: 'FIVB, CEV' },
  handball: { canonical: 'handball', label: 'Handball', flagship: 'Bundesliga, EHF, Worlds' },
  cycling: { canonical: 'cycling', label: 'Cycling', flagship: 'UCI World Tour' },
  snooker: { canonical: 'snooker', label: 'Snooker', flagship: 'World Snooker Tour' },
  darts: { canonical: 'darts', label: 'Darts', flagship: 'PDC, World Championship' },
  esports: { canonical: 'esports', label: 'Esports', flagship: 'LoL, Dota 2, CS, COD, R6' },
}

// Common league-shorthand aliases that resolve to a main sport hub.
const SPORT_ALIASES: Record<string, string> = {
  nba: 'basketball', wnba: 'basketball', fiba: 'basketball', ncaa: 'basketball',
  nfl: 'football', cfl: 'football', ncaaf: 'football',
  nhl: 'hockey', f1: 'motorsport', ufc: 'combat', pfl: 'combat', mma: 'combat', mlb: 'baseball',
}

// canonical sport key → route segment, for linking an event/league/team back up to its sport hub.
const CANON_TO_ROUTE: Record<string, string> = Object.fromEntries(
  Object.entries(SPORTS).map(([route, info]) => [info.canonical, route]),
)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url)
    if (requestUrl.protocol !== 'https:' || requestUrl.hostname === 'www.silbosports.com') {
      requestUrl.protocol = 'https:'
      requestUrl.hostname = 'silbosports.com'
      return Response.redirect(requestUrl.toString(), 308)
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const { pathname } = requestUrl
      const entity =
        idFrom(pathname, 'events', 'event') ??
        idFrom(pathname, 'leagues', 'league') ??
        idFrom(pathname, 'teams', 'team') ??
        idFrom(pathname, 'sports', 'sport')
      if (entity) {
        try {
          const rewritten = await renderMeta(request, env, entity)
          if (rewritten) return rewritten
          // Entity route but no matching public record (deleted id, private league, bad slug). The
          // SPA still renders a "not found" shell — keep that URL out of the index so unknown ids
          // don't accrue thin pages, while staying a 200 so humans who deep-link aren't broken.
          const noindexed = await renderNoindexShell(request, env)
          if (noindexed) return noindexed
        } catch {
          // fall through to the unmodified asset response below
        }
      }
    }
    return env.ASSETS.fetch(request)
  },
}

type Entity = { kind: 'event' | 'league' | 'team' | 'sport'; id: string }

function idFrom(pathname: string, segment: string, kind: Entity['kind']): Entity | null {
  const m = pathname.match(new RegExp(`^/${segment}/([^/]+)/?$`))
  return m ? { kind, id: decodeURIComponent(m[1]) } : null
}

async function renderMeta(request: Request, env: Env, entity: Entity): Promise<Response | null> {
  const meta =
    entity.kind === 'event'
      ? await eventMeta(env, entity.id)
      : entity.kind === 'league'
        ? await leagueMeta(env, entity.id)
        : entity.kind === 'team'
          ? await teamMeta(env, entity.id)
          : await sportMeta(env, entity.id)
  if (!meta) return null

  const assetResponse = await env.ASSETS.fetch(new Request(`${ORIGIN}/`, { headers: request.headers }))
  const contentType = assetResponse.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return null

  const headers = new Headers(assetResponse.headers)
  // Edge-cache the rewritten shell briefly so scraper/AI bursts don't hammer Supabase, while
  // staying fresh enough during a live tournament where times and statuses move.
  headers.set('cache-control', 'public, max-age=120, s-maxage=300')

  let rewriter = new HTMLRewriter()
    .on('title', new TextSetter(meta.title))
    .on('meta[name="description"]', new AttrSetter('content', meta.description))
    .on('meta[property="og:title"]', new AttrSetter('content', meta.title))
    .on('meta[property="og:description"]', new AttrSetter('content', meta.description))
    .on('meta[property="og:url"]', new AttrSetter('content', meta.canonical))
    .on('meta[property="og:image"]', new AttrSetter('content', OG_IMAGE))
    .on('meta[name="twitter:title"]', new AttrSetter('content', meta.title))
    .on('meta[name="twitter:description"]', new AttrSetter('content', meta.description))
    .on('meta[name="twitter:image"]', new AttrSetter('content', OG_IMAGE))
    .on('link[rel="canonical"]', new AttrSetter('href', meta.canonical))
    .on('head', new JsonLdInjector(meta))
    .on('#root', new RootInjector(meta))

  // Perishable: a finished/past fixture is rewritten to noindex,follow so it leaves the index
  // without breaking humans who still deep-link in from a calendar entry. Flip this to a 410 here
  // if hard removal is ever wanted instead.
  if (meta.noindex) {
    rewriter = rewriter.on('meta[name="robots"]', new AttrSetter('content', 'noindex, follow'))
  }

  return rewriter.transform(new Response(assetResponse.body, { status: 200, headers }))
}

// Fetch the static shell and force robots=noindex,follow without touching anything else. Used for
// entity routes whose id resolves to no public record, so the SPA's "not found" view never earns
// an index entry. A short edge cache keeps scraper bursts off Supabase.
async function renderNoindexShell(request: Request, env: Env): Promise<Response | null> {
  const assetResponse = await env.ASSETS.fetch(new Request(`${ORIGIN}/`, { headers: request.headers }))
  const contentType = assetResponse.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return null
  const headers = new Headers(assetResponse.headers)
  headers.set('cache-control', 'public, max-age=120, s-maxage=300')
  return new HTMLRewriter()
    .on('meta[name="robots"]', new AttrSetter('content', 'noindex, follow'))
    .transform(new Response(assetResponse.body, { status: 200, headers }))
}

class TextSetter {
  constructor(private value: string) {}
  element(el: { setInnerContent: (v: string) => void }) {
    el.setInnerContent(this.value)
  }
}

class AttrSetter {
  constructor(
    private attr: string,
    private value: string,
  ) {}
  element(el: { setAttribute: (name: string, value: string) => void }) {
    el.setAttribute(this.attr, this.value)
  }
}

// Inject a crawler-visible summary as the first child of #root. React's createRoot().render()
// replaces #root's children on mount, so JS users never see duplicated content.
class RootInjector {
  constructor(private meta: Meta) {}
  element(el: { prepend: (content: string, opts: { html: boolean }) => void }) {
    const block =
      `<section data-ssr-summary style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">` +
      `<h1>${escapeHtml(this.meta.heading)}</h1>${this.meta.summaryHtml}</section>`
    el.prepend(block, { html: true })
  }
}

class JsonLdInjector {
  constructor(private meta: Meta) {}
  element(el: { append: (content: string, opts: { html: boolean }) => void }) {
    if (!this.meta.jsonLd) return
    el.append(
      `<script type="application/ld+json" id="jsonld-event">${escapeJsonScript(this.meta.jsonLd)}</script>`,
      { html: true },
    )
  }
}

// --- entity metadata --------------------------------------------------------

type ListEventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean | null
  league_id: string | null
  leagues: { name: string | null } | null
  venues: { name: string | null } | null
}

const LIST_SELECT = 'id,title,starts_at,starts_at_tbd,league_id,leagues(name),venues(name)'

// Upcoming public fixtures for an events filter (e.g. league_id=eq.X or sports.key=eq.Y). Mirrors
// the app's now−3h / status≠finished window so finished games never reach the crawlable copy.
async function upcomingEvents(env: Env, filter: string, extraSelect = ''): Promise<ListEventRow[]> {
  const nowIso = new Date(Date.now() - 3 * 3600_000).toISOString()
  const path =
    `events?select=${LIST_SELECT}${extraSelect}&${filter}` +
    `&visibility=eq.public&status=neq.finished&starts_at=gte.${nowIso}&order=starts_at.asc&limit=24`
  return (await supabaseSelect<ListEventRow>(env, path)) ?? []
}

function fixtureListHtml(events: ListEventRow[]): string {
  if (!events.length) {
    return `<p>No upcoming fixtures are scheduled right now — new dates sync in automatically as they are published.</p>`
  }
  const items = events
    .map((e) => {
      const when = formatWhen(e.starts_at, e.starts_at_tbd)
      const timePart = when
        ? ` — <time datetime="${escapeHtml(e.starts_at ?? '')}">${escapeHtml(when)}</time>`
        : ' — start time to be confirmed'
      const venue = e.venues?.name ? ` · ${escapeHtml(e.venues.name)}` : ''
      return `<li><a href="/events/${escapeHtml(e.id)}">${escapeHtml(e.title)}</a>${timePart}${venue}</li>`
    })
    .join('')
  return `<ul>${items}</ul>`
}

// Distinct leagues seen across a sport's upcoming events → crawlable "browse by competition" links.
function leagueLinksHtml(events: ListEventRow[]): string {
  const seen = new Map<string, string>()
  for (const e of events) {
    if (e.league_id && e.leagues?.name && !seen.has(e.league_id)) seen.set(e.league_id, e.leagues.name)
  }
  if (!seen.size) return ''
  const links = [...seen.entries()]
    .map(([id, name]) => `<li><a href="/leagues/${escapeHtml(id)}">${escapeHtml(name)} schedule</a></li>`)
    .join('')
  return `<p>Browse competitions:</p><ul>${links}</ul>`
}

function sportHubLink(canonicalKey: string | null | undefined): string {
  const route = canonicalKey ? CANON_TO_ROUTE[canonicalKey] : undefined
  return route ? `<p><a href="/sports/${route}">All ${escapeHtml(SPORTS[route].label)} schedules</a></p>` : ''
}

type EventRow = {
  id: string
  title: string
  starts_at: string | null
  starts_at_tbd: boolean | null
  status: string | null
  kind: string | null
  league_id: string | null
  leagues: { name: string | null } | null
  sports: { key: string | null } | null
  venues: { name: string | null; city: string | null; country: string | null } | null
}

type EventPerformerRow = {
  competitors: { name: string | null; kind: string | null } | null
}

function eventStatusUrl(status: string | null): string {
  if (status === 'cancelled') return 'https://schema.org/EventCancelled'
  if (status === 'postponed') return 'https://schema.org/EventPostponed'
  return 'https://schema.org/EventScheduled'
}

function performerType(kind: string | null): string {
  return kind === 'person' ? 'Person' : 'PerformingGroup'
}

function inferredMatchPerformers(title: string): Array<{ '@type': string; name: string }> {
  const names = title
    .split(/\s+(?:vs\.?|versus|v\.?)\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length !== 2 || names.some((name) => /^(?:tbd|tbc|unknown)$/i.test(name))) return []
  return names.map((name) => ({ '@type': 'PerformingGroup', name }))
}

function eventStructuredData(row: EventRow, performers: Array<{ name: string; kind: string | null }>): Record<string, unknown> | undefined {
  if (!row.starts_at) return undefined
  const start = new Date(row.starts_at)
  if (Number.isNaN(start.getTime())) return undefined
  const url = `${ORIGIN}/events/${row.id}`
  const end = new Date(start.getTime() + (SPORT_TIMING_MINUTES[row.sports?.key ?? ''] ?? 120) * 60_000)
  const venue = row.venues
  const explicitPerformers = performers.map((performer) => ({ '@type': performerType(performer.kind), name: performer.name }))
  const mappedPerformers = explicitPerformers.length ? explicitPerformers : inferredMatchPerformers(row.title)
  const location =
    venue?.name || venue?.city || venue?.country
    ? {
        '@type': 'Place',
        name: venue.name || venue.city || row.leagues?.name || 'Venue to be confirmed',
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
  if (!location || !mappedPerformers.length) return undefined
  const descriptionParts = [
    row.title,
    row.leagues?.name ? `in ${row.leagues.name}` : null,
    venue?.name ? `at ${venue.name}` : null,
  ].filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: row.title,
    description: `${descriptionParts.join(' ')}. See the start time in your local timezone, find where to watch, and add it to your calendar with Silbo Sports.`,
    image: [`${ORIGIN}/og-cover.png`],
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    eventStatus: eventStatusUrl(row.status),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location,
    performer: mappedPerformers,
    competitor: mappedPerformers,
    organizer: {
      '@type': 'Organization',
      name: row.leagues?.name || 'Silbo Sports',
      url: row.league_id ? `${ORIGIN}/leagues/${row.league_id}` : ORIGIN,
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

async function eventMeta(env: Env, id: string): Promise<Meta | null> {
  const rows = await supabaseSelect<EventRow>(
    env,
    `events?id=eq.${encodeURIComponent(id)}&select=id,title,starts_at,starts_at_tbd,status,kind,league_id,leagues(name),sports(key),venues(name,city,country)&limit=1`,
  )
  const row = rows?.[0]
  if (!row?.title) return null
  const performerRows = await supabaseSelect<EventPerformerRow>(
    env,
    `event_competitors?event_id=eq.${encodeURIComponent(id)}&select=competitors(name,kind)&limit=20`,
  )
  const performers = (performerRows ?? []).flatMap((entry) =>
    entry.competitors?.name ? [{ name: entry.competitors.name, kind: entry.competitors.kind }] : [],
  )

  const league = row.leagues?.name ?? null
  const venue = row.venues?.name ?? null
  const when = formatWhen(row.starts_at, row.starts_at_tbd)
  const leaguePart = league ? ` (${league})` : ''
  const wherePart = venue ? ` at ${venue}` : ''

  const description = when
    ? `${row.title}${leaguePart} kicks off ${when}${wherePart}. See the start time in your local timezone, where to watch, and add it to your calendar with Silbo Sports.`
    : `${row.title}${leaguePart}${wherePart}. Start time, where to watch, and add to your calendar in your local timezone with Silbo Sports.`

  const summaryHtml =
    // Lead with the literal question + answer ("What time is X? X starts …") so the crawlable copy
    // matches "what time is {event}" searches; the React page renders the same Q&A visibly.
    `<p>${escapeHtml(
      when
        ? `What time is ${row.title}? ${row.title} starts ${when}${wherePart}.`
        : `When is ${row.title}? The start time is still to be confirmed${wherePart}.`,
    )}</p>` +
    (league && row.league_id
      ? `<p>Competition: <a href="/leagues/${escapeHtml(row.league_id)}">${escapeHtml(league)}</a></p>`
      : league
        ? `<p>Competition: ${escapeHtml(league)}</p>`
        : '') +
    sportHubLink(row.sports?.key) +
    `<p>${escapeHtml(LOCAL_TIME_NOTE)}</p>`

  return {
    title: `${row.title} — start time & where to watch | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/events/${id}`,
    heading: when ? `${row.title} — ${when}` : row.title,
    summaryHtml,
    jsonLd: eventStructuredData(row, performers),
    noindex: isPerishable(row.status, row.starts_at),
  }
}

type LeagueRow = { name: string | null; country: string | null; sports: { key: string | null } | null }

async function leagueMeta(env: Env, id: string): Promise<Meta | null> {
  const rows = await supabaseSelect<LeagueRow>(
    env,
    `leagues?id=eq.${encodeURIComponent(id)}&is_public=eq.true&select=name,country,sports(key)&limit=1`,
  )
  const row = rows?.[0]
  if (!row?.name) return null

  const events = await upcomingEvents(env, `league_id=eq.${encodeURIComponent(id)}`)
  const description = `${row.name} upcoming fixtures in your local timezone — ${
    events.length ? `next up: ${events[0].title}. ` : ''
  }Follow ${row.name}, see where to watch, and sync the schedule to your calendar with Silbo Sports.`

  const summaryHtml =
    `<p>${escapeHtml(`${row.name} fixtures and start times${row.country ? ` (${row.country})` : ''}.`)}</p>` +
    fixtureListHtml(events) +
    `<p>${escapeHtml(LOCAL_TIME_NOTE)}</p>` +
    sportHubLink(row.sports?.key)

  return {
    title: `${row.name} schedule & fixtures | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/leagues/${id}`,
    heading: `${row.name} schedule & fixtures`,
    summaryHtml,
    // A league with no upcoming fixtures (off-season, between rounds) is thin — keep it out of the
    // index but follow internal links so it re-enters naturally once fixtures land.
    noindex: events.length === 0,
  }
}

type CompetitorRow = {
  name: string | null
  kind: string | null
  country: string | null
  league_id: string | null
  leagues: { name: string | null } | null
  sports: { key: string | null } | null
}

async function teamMeta(env: Env, id: string): Promise<Meta | null> {
  const rows = await supabaseSelect<CompetitorRow>(
    env,
    `competitors?id=eq.${encodeURIComponent(id)}&kind=neq.custom_team&select=name,kind,country,league_id,leagues(name),sports(key)&limit=1`,
  )
  const row = rows?.[0]
  if (!row?.name) return null

  const noun = row.kind === 'person' ? 'player' : 'team'
  const events = await teamEvents(env, id)
  const description = `${row.name} upcoming schedule in your local timezone${
    events.length ? ` — next up: ${events[0].title}.` : '.'
  } Follow ${row.name}, see where to watch, and sync every fixture to your calendar with Silbo Sports.`

  const leagueLink =
    row.league_id && row.leagues?.name
      ? `<p>Competes in <a href="/leagues/${escapeHtml(row.league_id)}">${escapeHtml(row.leagues.name)}</a>.</p>`
      : ''

  const summaryHtml =
    `<p>${escapeHtml(`${row.name} ${noun} schedule${row.country ? ` (${row.country})` : ''}.`)}</p>` +
    fixtureListHtml(events) +
    leagueLink +
    sportHubLink(row.sports?.key) +
    `<p>${escapeHtml(LOCAL_TIME_NOTE)}</p>`

  return {
    title: `${row.name} schedule & fixtures | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/teams/${id}`,
    heading: `${row.name} schedule`,
    summaryHtml,
    // No upcoming fixtures for this team/player → thin between seasons. Noindex,follow until the
    // next fixture syncs in (mirrors leagueMeta).
    noindex: events.length === 0,
  }
}

async function sportMeta(env: Env, key: string): Promise<Meta | null> {
  const info = SPORTS[key] ?? (SPORT_ALIASES[key] ? SPORTS[SPORT_ALIASES[key]] : undefined)
  if (!info) return null

  const events = await upcomingEvents(env, `sports.key=eq.${encodeURIComponent(info.canonical)}`, ',sports!inner(key)')
  const description = `${info.label} schedule and live times — ${info.flagship} and more in your local timezone.${
    events.length ? ` Next up: ${events[0].title}.` : ''
  } Follow teams and players, see where to watch, and sync to your calendar with Silbo Sports.`

  const summaryHtml =
    `<p>${escapeHtml(`${info.label} fixtures across ${info.flagship}, every start time in your local timezone.`)}</p>` +
    leagueLinksHtml(events) +
    `<p>Upcoming ${escapeHtml(info.label.toLowerCase())} fixtures:</p>` +
    fixtureListHtml(events) +
    `<p>${escapeHtml(LOCAL_TIME_NOTE)}</p>`

  return {
    title: `${info.label} schedule & live times | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/sports/${key}`,
    heading: `${info.label} schedule & live times`,
    summaryHtml,
  }
}

// Team/player upcoming events, resolved through the event_competitors join (no league_id needed on
// the fixture). Two small reads keep it robust across PostgREST embedded-filter quirks.
async function teamEvents(env: Env, competitorId: string): Promise<ListEventRow[]> {
  const links = await supabaseSelect<{ event_id: string }>(
    env,
    `event_competitors?competitor_id=eq.${encodeURIComponent(competitorId)}&select=event_id&limit=400`,
  )
  const ids = [...new Set((links ?? []).map((l) => l.event_id))].filter(Boolean)
  if (!ids.length) return []
  return upcomingEvents(env, `id=in.(${ids.slice(0, 200).map(encodeURIComponent).join(',')})`)
}

// --- helpers ----------------------------------------------------------------

async function supabaseSelect<T>(env: Env, path: string): Promise<T[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      accept: 'application/json',
    },
  })
  if (!res.ok) return null
  return (await res.json()) as T[]
}

// A fixture is perishable once it has finished, or once its start time is comfortably in the past
// (covers events whose status never flips). The grace window matches the app's 3h "still live" lane
// with headroom for long formats.
function isPerishable(status: string | null, startsAt: string | null): boolean {
  if (status === 'finished') return true
  if (!startsAt) return false
  const t = new Date(startsAt).getTime()
  return Number.isFinite(t) && t < Date.now() - 6 * 3600_000
}

function formatWhen(iso: string | null, tbd: boolean | null): string | null {
  if (!iso || tbd) return null
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

function clamp(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJsonScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
