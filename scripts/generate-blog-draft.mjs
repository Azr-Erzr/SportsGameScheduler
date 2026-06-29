// Silbo Sports blog — AI draft generator (human-review-before-publish).
//
// Generates ONE article draft from a topic and inserts it into public.blog_posts as status='draft'.
// A person reviews and edits the draft, then flips status to 'published' (and sets published_at)
// when it's accurate and good. Drafts are invisible to the site until then (RLS gates public reads
// to published rows), so nothing un-reviewed ever goes live — this is the guardrail that keeps the
// blog on the right side of Google's scaled-content-abuse policy.
//
// Usage:
//   ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/generate-blog-draft.mjs "Topic to write about" [related_event_id]
//
// Requires: npm i -D @anthropic-ai/sdk   (@supabase/supabase-js is already a dependency)
// Env: ANTHROPIC_API_KEY, VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.

import fs from 'node:fs/promises'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()

async function loadEnvFile() {
  try {
    const text = await fs.readFile(path.join(root, '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trimStart().startsWith('#')) continue
      const i = line.indexOf('=')
      if (i === -1) continue
      const key = line.slice(0, i).trim()
      const value = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
      process.env[key] ??= value
    }
  } catch {
    // no .env — rely on the process environment
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const SYSTEM = `You write short, accurate sports articles for Silbo Sports, a multi-sport schedule app.
Rules:
- Be factual and grounded. Do NOT invent specific stats, quotes, dates, transfers, or results you are
  not certain of. If a detail is uncertain, write around it or speak generally. It is better to be
  vague than wrong — a human will fact-check before publishing.
- 350-600 words. Markdown: use ## subheadings, short paragraphs, and at most one bullet list.
- Write for a fan who wants context plus "when is it / where do I watch it". Naturally mention
  following the team/event and seeing start times in your local timezone.
- Do NOT write a "catch the game at [time]" call-to-action box — the app renders that automatically
  from live schedule data. Just write the article body.
- Neutral, informative, lightly engaging. No hype, no clickbait, no emoji.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'dek', 'body_markdown', 'seo_description', 'sport_key'],
  properties: {
    title: { type: 'string', description: 'Headline, ~50-70 chars, no site name.' },
    slug: { type: 'string', description: 'url-safe-kebab-case derived from the title.' },
    dek: { type: 'string', description: 'One-sentence standfirst/excerpt.' },
    body_markdown: { type: 'string', description: 'The article body in markdown (## headings, paragraphs).' },
    seo_description: { type: 'string', description: 'Meta description, ~150 chars.' },
    sport_key: {
      type: ['string', 'null'],
      description:
        "Canonical sport key if clearly one sport: soccer, basketball, american_football, hockey, tennis, golf, motorsport, combat_sports, athletics, olympic_sports, baseball, cricket, rugby, esports — else null.",
    },
  },
}

async function main() {
  await loadEnvFile()
  const topic = process.argv[2]
  const relatedEventId = process.argv[3] ?? null
  if (!topic) {
    console.error('Usage: node scripts/generate-blog-draft.mjs "Topic" [related_event_id]')
    process.exit(1)
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  if (!supabaseUrl || !serviceKey) throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')

  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: `Write a Silbo Sports blog article about: ${topic}` }],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error(`Model declined the request: ${response.stop_details?.explanation ?? 'refusal'}`)
  }
  const jsonText = response.content.find((b) => b.type === 'text')?.text
  if (!jsonText) throw new Error('No text content returned from the model')
  const draft = JSON.parse(jsonText)

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Ensure a unique slug (append a short suffix on collision).
  let slug = slugify(draft.slug || draft.title)
  const { data: existing } = await supabase.from('blog_posts').select('id').eq('slug', slug).maybeSingle()
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title: draft.title,
      dek: draft.dek,
      body_markdown: draft.body_markdown,
      seo_description: draft.seo_description,
      sport_key: draft.sport_key ?? null,
      related_event_id: relatedEventId,
      status: 'draft',
    })
    .select('id, slug')
    .single()
  if (error) throw new Error(`Insert failed: ${error.message}`)

  console.log(`\n✅ Draft created: ${data.id}  (slug: ${data.slug})`)
  console.log(`   Title: ${draft.title}`)
  console.log(`   Words: ~${String(draft.body_markdown).split(/\s+/).length}`)
  console.log('\nReview it, then publish with:')
  console.log(
    `   update public.blog_posts set status='published', published_at=now() where id='${data.id}';`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
