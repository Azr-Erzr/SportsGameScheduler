import type { PropsWithChildren, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Search, Share2 } from 'lucide-react'
import { brand } from '../domain/brand'
import { Button, EmptyState } from '../components/ui'
import { useDocumentMeta, useJsonLd } from '../lib/seo'
import { aboutContent, faqContent, howItWorksContent, type Faq } from '../content/siteContent'

// Standalone editorial pages — substantive, original content that gives the site real depth beyond
// the scheduling tool (and gives an AdSense reviewer something to read). Shares the clean legal
// layout look; each sets its own document meta.

function ContentLayout({ title, intro, children }: PropsWithChildren<{ title: string; intro: ReactNode }>) {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 border-b border-primary/15 pb-6">
        <p className="board-label mb-2 text-xs uppercase tracking-[0.2em] text-primary/70">{brand.appName}</p>
        <h1 className="font-display text-3xl tracking-wide text-ink sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base text-ink/65">{intro}</p>
      </header>
      <div className="space-y-8 text-sm leading-relaxed text-ink/80 [&_a]:text-primary [&_a]:underline [&_h2]:font-display [&_h2]:text-lg [&_h2]:tracking-wide [&_h2]:text-ink">
        {children}
      </div>
    </article>
  )
}

function Section({ id, heading, children }: PropsWithChildren<{ id: string; heading: string }>) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id}>{heading}</h2>
      {children}
    </section>
  )
}

export function AboutPage() {
  useDocumentMeta({
    title: 'About Silbo Sports — one schedule for every sport you follow',
    description:
      'What Silbo Sports is, why we built it, which sports it covers, and how a free multi-sport schedule that converts every start time to your local zone makes money.',
    canonicalPath: '/about',
  })
  return (
    <ContentLayout title={aboutContent.title} intro={aboutContent.intro}>
      {aboutContent.sections.map((section, i) => (
        <Section key={section.heading} id={`about-${i}`} heading={section.heading}>
          {section.paragraphs.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </Section>
      ))}
      <div className="flex flex-wrap gap-2 border-t border-primary/15 pt-6">
        <Link to="/how-it-works">
          <Button variant="ghost">
            How it works <ArrowRight size={15} />
          </Button>
        </Link>
        <Link to="/explore">
          <Button variant="ghost">Explore sports</Button>
        </Link>
        <Link to="/faq">
          <Button variant="ghost">Read the FAQ</Button>
        </Link>
      </div>
    </ContentLayout>
  )
}

const STEP_ICONS = [Search, CalendarDays, Share2]

export function HowItWorksPage() {
  useDocumentMeta({
    title: 'How Silbo Sports works — follow, convert, sync',
    description:
      'A three-step guide to Silbo Sports: follow the teams and leagues you care about, see every start time in your local zone, then sync to your calendar, export, or get reminders.',
    canonicalPath: '/how-it-works',
  })
  return (
    <ContentLayout title={howItWorksContent.title} intro={howItWorksContent.intro}>
      {howItWorksContent.steps.map((step, i) => {
        const Icon = STEP_ICONS[i] ?? Search
        return (
          <Section key={step.heading} id={`step-${i}`} heading={step.heading}>
            <span className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon size={18} />
            </span>
            {step.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </Section>
        )
      })}
      <div className="flex flex-wrap gap-2 border-t border-primary/15 pt-6">
        <Link to="/explore">
          <Button>
            Start exploring <ArrowRight size={15} />
          </Button>
        </Link>
        <Link to="/faq">
          <Button variant="ghost">Read the FAQ</Button>
        </Link>
      </div>
    </ContentLayout>
  )
}

export function FaqPage() {
  useDocumentMeta({
    title: 'Silbo Sports FAQ — schedules, sync, accounts and data',
    description:
      'Answers to common questions about Silbo Sports: whether it is free, which sports it covers, how start times are converted, how calendar sync and reminders work, and how your data is handled.',
    canonicalPath: '/faq',
  })
  // FAQPage structured data so the questions are eligible for rich results in search.
  useJsonLd('faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqContent.faqs.map((f: Faq) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })
  return (
    <ContentLayout title={faqContent.title} intro={faqContent.intro}>
      <dl className="space-y-5">
        {faqContent.faqs.map((f: Faq) => (
          <div key={f.q} className="border-b border-primary/10 pb-5 last:border-0">
            <dt className="font-display text-base tracking-wide text-ink">{f.q}</dt>
            <dd className="mt-2 text-ink/75">{f.a}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-primary/15 pt-6 text-ink/65">
        Still stuck? See <Link to="/how-it-works">how it works</Link> or read the{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </ContentLayout>
  )
}

export function NotFoundPage() {
  // A real 404 view (noindex) instead of redirecting unknown URLs to a live page, which Google reads
  // as a soft 404. The route still returns 200 from the SPA shell, but crawlers are told not to index.
  useDocumentMeta({
    title: 'Page not found — Silbo Sports',
    canonicalPath: undefined,
    robots: 'noindex, follow',
  })
  return (
    <div className="py-10">
      <EmptyState title="Page not found" body="That page doesn’t exist or has moved. Try exploring sports or your schedule.">
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/explore">
            <Button variant="ghost">Explore sports</Button>
          </Link>
          <Link to="/my-schedule">
            <Button variant="ghost">My schedule</Button>
          </Link>
        </div>
      </EmptyState>
    </div>
  )
}
