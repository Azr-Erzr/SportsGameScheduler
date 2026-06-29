import { useEffect } from 'react'

// Per-route document head management for an SPA. Modern crawlers (Googlebot) render JS and pick
// up titles/canonical/JSON-LD set here, so dynamic routes get real, distinct SEO metadata.
// For first-paint/no-JS crawlers, see the prerender recommendation in docs/seo-and-i18n-plan.md.

export const SEO_ORIGIN = 'https://silbosports.com'

function upsertMetaByName(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

const BASE_TITLE = 'Silbo Sports — every game, in your calendar'
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large'

export function useDocumentMeta(opts: {
  title?: string
  description?: string
  canonicalPath?: string
  /**
   * Override the page's robots directive (e.g. 'noindex, follow' for an empty/finished entity).
   * JS-rendering crawlers run React, which overwrites the Worker-set <head>, so a thin route must
   * re-assert noindex here or the Worker's directive is lost on hydration. Restored to the default
   * on unmount so the next route is indexable again.
   */
  robots?: string
}) {
  const { title, description, canonicalPath, robots } = opts
  useEffect(() => {
    if (title) document.title = title
    if (description) upsertMetaByName('description', description)
    if (canonicalPath) upsertCanonical(`${SEO_ORIGIN}${canonicalPath}`)
    if (robots) upsertMetaByName('robots', robots)
    return () => {
      document.title = BASE_TITLE
      if (robots) upsertMetaByName('robots', DEFAULT_ROBOTS)
    }
  }, [title, description, canonicalPath, robots])
}

// Inject a JSON-LD block for the lifetime of the component (e.g. a SportsEvent on /events/:id).
export function useJsonLd(id: string, data: Record<string, unknown> | null) {
  useEffect(() => {
    if (!data) return
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = `jsonld-${id}`
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [id, data])
}
