import { Fragment, type ReactNode } from 'react'
import { ArrowRight, Bell, CalendarClock, Tv } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAppState } from '../app/state-context'
import { Button, EmptyState, Panel } from '../components/ui'
import { useBlogPost, useBlogPosts, type BlogPost } from '../data/blog'
import { useEvent } from '../data/liveSport'
import { brand } from '../domain/brand'
import { SEO_ORIGIN, useDocumentMeta, useJsonLd } from '../lib/seo'
import { formatLongDate, formatTime } from '../lib/time'

// Silbo Sports blog. Articles are stored in Supabase (src/data/blog.ts) and rendered here on the
// same domain, so internal links pass equity to the schedule pages. Each post can be tied to a real
// event; when it is, the "catch the game" CTA pulls accurate time / where-to-watch from live data
// instead of inventing it — the whole point of a sports-schedule blog linking back to itself.

function formatPublished(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

// ── Minimal, safe markdown → React. No dangerouslySetInnerHTML: we build elements, so AI-authored
// bodies can't inject markup. Supports paragraphs, ## / ### headings, - bullet lists, and inline
// **bold**, *italic*, `code`, and [text](url) links. Unknown syntax renders as plain text.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const key = `${keyBase}-${i++}`
    if (match[1]) nodes.push(<strong key={key}>{match[1]}</strong>)
    else if (match[2]) nodes.push(<em key={key}>{match[2]}</em>)
    else if (match[3]) nodes.push(<code key={key} className="rounded bg-primary/10 px-1 py-0.5 text-[0.85em]">{match[3]}</code>)
    else if (match[4] && match[5]) {
      const href = match[5]
      const internal = href.startsWith('/')
      nodes.push(
        internal ? (
          <Link key={key} to={href} className="text-primary underline">{match[4]}</Link>
        ) : (
          <a key={key} href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{match[4]}</a>
        ),
      )
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function MarkdownBlock({ block, idx }: { block: string; idx: number }) {
  const trimmed = block.trim()
  if (trimmed.startsWith('### ')) {
    return <h3 className="mt-6 font-display text-lg tracking-wide text-ink">{renderInline(trimmed.slice(4), `h3-${idx}`)}</h3>
  }
  if (trimmed.startsWith('## ')) {
    return <h2 className="mt-8 font-display text-2xl tracking-wide text-ink">{renderInline(trimmed.slice(3), `h2-${idx}`)}</h2>
  }
  const lines = trimmed.split('\n')
  if (lines.every((line) => line.trim().startsWith('- '))) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((line, j) => (
          <li key={j}>{renderInline(line.trim().slice(2), `li-${idx}-${j}`)}</li>
        ))}
      </ul>
    )
  }
  return <p>{renderInline(trimmed, `p-${idx}`)}</p>
}

// "Catch the game" callout, rendered from a real event when the post is tied to one. The whole
// value of the blog is this accurate, data-backed funnel to the schedule.
function GameCta({ eventId }: { eventId: string }) {
  const { prefs } = useAppState()
  const { event, loading } = useEvent(eventId)
  if (loading || !event) return null

  const opts = { locale: prefs.locale, hour12: prefs.hour12 ?? undefined }
  const when = event.startsAt
    ? `${formatLongDate(event.startsAt, prefs.timezone, opts)} at ${formatTime(event.startsAt, prefs.timezone, opts)} (${prefs.timezone})`
    : 'a time to be confirmed'

  return (
    <Panel className="not-prose my-8 border-primary/30 bg-primary/5">
      <p className="board-label mb-2 text-xs uppercase tracking-[0.18em] text-primary/70">Catch the game</p>
      <p className="text-base font-bold text-ink">{event.title}</p>
      <p className="mt-1 text-sm text-ink/70">
        Kicks off {when}
        {event.leagueName ? ` · ${event.leagueName}` : ''}. See it in your own timezone, find where to watch, and get a
        reminder before it starts on {brand.appName}.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={`/events/${event.id}`}>
          <Button>
            <CalendarClock size={15} /> Event details
          </Button>
        </Link>
        <Link to="/settings/alerts">
          <Button variant="ghost">
            <Bell size={15} /> Get alerts
          </Button>
        </Link>
        {event.sportKey ? (
          <Link to="/explore">
            <Button variant="ghost">
              <Tv size={15} /> Full schedule
            </Button>
          </Link>
        ) : null}
      </div>
    </Panel>
  )
}

function BlogCard({ post }: { post: BlogPost }) {
  const published = formatPublished(post.publishedAt)
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-card border border-primary/15 bg-surface/72 p-5 transition-colors hover:bg-primary/6"
    >
      {published ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/45">{published}</p>
      ) : null}
      <h2 className="mt-2 text-lg font-extrabold text-primary">{post.title}</h2>
      {post.dek ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/65">{post.dek}</p> : null}
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
        Read <ArrowRight size={14} />
      </span>
    </Link>
  )
}

export function BlogIndexPage() {
  const { posts, loading, configured } = useBlogPosts()
  useDocumentMeta({
    title: 'Silbo Sports blog — schedules, where to watch, and what is coming up',
    description:
      'News and explainers on the leagues, teams, and events you follow — with the local-time schedule and where to watch on Silbo Sports.',
    canonicalPath: '/blog',
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b border-primary/15 pb-6">
        <p className="board-label mb-2 text-xs uppercase tracking-[0.2em] text-primary/70">{brand.appName}</p>
        <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">The Silbo Sports blog</h1>
        <p className="mt-3 text-base text-ink/65">
          What is coming up across the sports you follow — every story links to the local-time schedule and where to watch.
        </p>
      </header>

      {loading ? (
        <p className="board-label py-10 text-center text-ink/50">Loading…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title={configured ? 'No posts yet' : 'Blog coming soon'}
          body={configured ? 'New articles are on the way — check back soon.' : 'The blog will appear here once it is connected.'}
        >
          <Link to="/explore">
            <Button variant="ghost">Explore sports</Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

export function BlogPostPage() {
  const { slug } = useParams()
  const { post, loading } = useBlogPost(slug)

  useDocumentMeta({
    title: post ? `${post.title} | Silbo Sports` : 'Article — Silbo Sports',
    description: post?.seoDescription ?? post?.dek ?? undefined,
    canonicalPath: slug ? `/blog/${slug}` : undefined,
    robots: !loading && !post ? 'noindex, follow' : undefined,
  })
  useJsonLd(
    'blog-article',
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.seoDescription ?? post.dek ?? undefined,
          datePublished: post.publishedAt ? post.publishedAt.toISOString() : undefined,
          author: { '@type': 'Organization', name: post.author },
          publisher: { '@type': 'Organization', name: brand.appName },
          ...(post.heroImageUrl ? { image: post.heroImageUrl } : {}),
          mainEntityOfPage: `${SEO_ORIGIN}/blog/${post.slug}`,
        }
      : null,
  )

  if (loading) return <p className="board-label py-10 text-center text-ink/50">Loading…</p>
  if (!post) {
    return (
      <EmptyState title="Article not found" body="This post doesn’t exist or hasn’t been published yet.">
        <Link to="/blog">
          <Button variant="ghost">Back to the blog</Button>
        </Link>
      </EmptyState>
    )
  }

  const published = formatPublished(post.publishedAt)
  const blocks = post.bodyMarkdown.split(/\n{2,}/).filter((b) => b.trim().length > 0)
  // Place the event CTA after the second block (mid-article) and again at the end — only when the
  // post is tied to a real event.
  const midCtaAfter = post.relatedEventId && blocks.length > 3 ? 1 : -1

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-primary/15 pb-6">
        <p className="board-label mb-2 text-xs uppercase tracking-[0.2em] text-primary/70">
          <Link to="/blog" className="hover:text-primary">{brand.appName} blog</Link>
        </p>
        <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">{post.title}</h1>
        {post.dek ? <p className="mt-3 text-base text-ink/65">{post.dek}</p> : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/40">
          {post.author}{published ? ` · ${published}` : ''}
        </p>
      </header>

      <div className="space-y-4 text-sm leading-relaxed text-ink/80 sm:text-base">
        {blocks.map((block, idx) => (
          <Fragment key={idx}>
            <MarkdownBlock block={block} idx={idx} />
            {idx === midCtaAfter && post.relatedEventId ? <GameCta eventId={post.relatedEventId} /> : null}
          </Fragment>
        ))}
        {post.relatedEventId ? <GameCta eventId={post.relatedEventId} /> : null}
      </div>

      <footer className="mt-10 border-t border-primary/15 pt-6">
        <p className="text-sm text-ink/65">
          Follow the sports you love and keep every fixture in your local time with{' '}
          <Link to="/explore" className="text-primary underline">{brand.appName}</Link>.
        </p>
        <Link to="/blog" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">
          More from the blog <ArrowRight size={14} />
        </Link>
      </footer>
    </article>
  )
}
