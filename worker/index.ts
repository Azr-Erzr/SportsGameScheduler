// Edge Worker for Silbo Sports.
//
// The site is a client-rendered SPA served from Cloudflare static assets. Modern crawlers run JS
// and pick up the per-route <head> set in src/lib/seo.ts, but social/link scrapers (Facebook, X,
// iMessage, WhatsApp, Slack) and most AI/answer crawlers do NOT run JS — they only see the static
// index.html, so every shared event/league link historically unfurled as the generic homepage
// card. That kills the single most viral surface during a tournament (links dropped in group
// chats) and starves AI engines of citable facts.
//
// This Worker runs FIRST only for /events/* and /leagues/* (see `run_worker_first` in
// wrangler.jsonc). For those routes it fetches the static shell, looks the entity up in Supabase,
// and rewrites the title/description/canonical/OG/Twitter tags AND injects a plain-text factual
// summary into the body (replaced by React on hydration for real users — progressive enhancement,
// not cloaking). Every other path is served as a fast static asset, untouched. Any error falls
// through to the unmodified asset response, so the SPA can never be taken down by this code.

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

type Meta = {
  title: string
  description: string
  canonical: string
  /** First-paint body summary for no-JS crawlers; React replaces #root on hydration. */
  heading: string
  summaryHtml: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const { pathname } = new URL(request.url)
      const eventId = matchId(pathname, 'events')
      const leagueId = matchId(pathname, 'leagues')
      if (eventId || leagueId) {
        try {
          const rewritten = await renderMeta(request, env, eventId, leagueId)
          if (rewritten) return rewritten
        } catch {
          // fall through to the unmodified asset response below
        }
      }
    }
    return env.ASSETS.fetch(request)
  },
}

function matchId(pathname: string, segment: 'events' | 'leagues'): string | null {
  const m = pathname.match(new RegExp(`^/${segment}/([^/]+)/?$`))
  return m ? decodeURIComponent(m[1]) : null
}

async function renderMeta(
  request: Request,
  env: Env,
  eventId: string | null,
  leagueId: string | null,
): Promise<Response | null> {
  const meta = eventId ? await eventMeta(env, eventId) : leagueId ? await leagueMeta(env, leagueId) : null
  if (!meta) return null

  const assetResponse = await env.ASSETS.fetch(new Request(`${ORIGIN}/`, { headers: request.headers }))
  const contentType = assetResponse.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return null

  const headers = new Headers(assetResponse.headers)
  // Edge-cache the rewritten shell briefly so scraper/AI bursts don't hammer Supabase, while
  // staying fresh enough during a live tournament where times and statuses move.
  headers.set('cache-control', 'public, max-age=120, s-maxage=300')

  const response = new HTMLRewriter()
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
    .on('#root', new RootInjector(meta))
    .transform(new Response(assetResponse.body, { status: 200, headers }))

  return response
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

type EventRow = {
  title: string
  starts_at: string | null
  starts_at_tbd: boolean | null
  status: string | null
  leagues: { name: string | null } | null
  sports: { key: string | null } | null
  venues: { name: string | null } | null
}

async function eventMeta(env: Env, id: string): Promise<Meta | null> {
  const rows = await supabaseSelect<EventRow>(
    env,
    `events?id=eq.${encodeURIComponent(id)}&select=title,starts_at,starts_at_tbd,status,leagues(name),sports(key),venues(name)&limit=1`,
  )
  const row = rows?.[0]
  if (!row?.title) return null

  const league = row.leagues?.name ?? null
  const venue = row.venues?.name ?? null
  const when = formatWhen(row.starts_at, row.starts_at_tbd)
  const leaguePart = league ? ` (${league})` : ''
  const wherePart = venue ? ` at ${venue}` : ''

  const description = when
    ? `${row.title}${leaguePart} kicks off ${when}${wherePart}. See the start time in your local timezone, where to watch, and add it to your calendar with Silbo Sports.`
    : `${row.title}${leaguePart}${wherePart}. Start time, where to watch, and add to your calendar in your local timezone with Silbo Sports.`

  const summaryHtml =
    `<p>${escapeHtml(
      when
        ? `${row.title} kicks off ${when}${wherePart}.`
        : `${row.title}${wherePart}. Start time to be confirmed.`,
    )}</p>` +
    (league ? `<p>Competition: ${escapeHtml(league)}</p>` : '') +
    `<p>Silbo Sports shows this start time in your local timezone, lists where to watch, and lets you add it to your calendar or get a reminder before kickoff.</p>`

  return {
    title: `${row.title} — start time & where to watch | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/events/${id}`,
    heading: when ? `${row.title} — ${when}` : row.title,
    summaryHtml,
  }
}

type LeagueRow = { name: string | null; sports: { key: string | null } | null }

async function leagueMeta(env: Env, id: string): Promise<Meta | null> {
  const rows = await supabaseSelect<LeagueRow>(
    env,
    `leagues?id=eq.${encodeURIComponent(id)}&select=name,sports(key)&limit=1`,
  )
  const row = rows?.[0]
  if (!row?.name) return null

  const description = `${row.name} upcoming fixtures and results in your local timezone. Follow ${row.name}, see where to watch, and sync the schedule to your calendar with Silbo Sports.`
  return {
    title: `${row.name} schedule & fixtures | Silbo Sports`,
    description: clamp(description, 300),
    canonical: `${ORIGIN}/leagues/${id}`,
    heading: `${row.name} schedule`,
    summaryHtml: `<p>${escapeHtml(description)}</p>`,
  }
}

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
