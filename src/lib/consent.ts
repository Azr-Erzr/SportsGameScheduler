// Cookie / advertising consent. Required before EU ad serving (see docs/monetization-ads-affiliate.md).
//
// Model: essential local storage (picks, prefs, this consent record) is always allowed — the app
// can't function without it and it's never used for tracking. Advertising cookies (Google AdSense)
// are off until the user explicitly accepts. We don't load the AdSense script at all until then,
// so declining means zero ad cookies — the simplest compliant posture. The consent banner
// (src/components/ConsentBanner.tsx) collects the choice; AdSlot reads it to decide what to render.

import { ADSENSE_CLIENT, adsConfigured } from './ads'

export type ConsentChoice = 'unset' | 'accepted' | 'rejected'

type ConsentRecord = { ads: boolean; decidedAt: string | null }

const KEY = 'mp.consent'

function read(): ConsentRecord {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ads: false, decidedAt: null }
    const parsed = JSON.parse(raw) as Partial<ConsentRecord>
    return { ads: Boolean(parsed.ads), decidedAt: parsed.decidedAt ?? null }
  } catch {
    return { ads: false, decidedAt: null }
  }
}

export function getConsentChoice(): ConsentChoice {
  const record = read()
  if (!record.decidedAt) return 'unset'
  return record.ads ? 'accepted' : 'rejected'
}

export function adsConsented(): boolean {
  return read().ads
}

const listeners = new Set<(choice: ConsentChoice) => void>()

export function subscribeConsent(fn: (choice: ConsentChoice) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setConsent(accepted: boolean) {
  const record: ConsentRecord = { ads: accepted, decidedAt: new Date().toISOString() }
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    /* storage unavailable — treat as session-only choice */
  }
  if (accepted) loadAdSense()
  const choice = getConsentChoice()
  listeners.forEach((fn) => fn(choice))
}

// Re-open the banner so a user can change a prior decision.
export function resetConsent() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn('unset'))
}

let adSenseRequested = false

// Inject the AdSense loader once, only after consent. Kept out of index.html so the script
// (and its cookies) never load for users who haven't accepted advertising.
export function loadAdSense() {
  if (adSenseRequested || !adsConfigured || typeof document === 'undefined') return
  if (document.querySelector('script[data-silbo-adsense]')) {
    adSenseRequested = true
    return
  }
  adSenseRequested = true
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.dataset.silboAdsense = 'true'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  document.head.appendChild(script)
}

// Call once at startup: if the user already accepted in a previous session, restore the script.
export function initConsent() {
  if (adsConsented()) loadAdSense()
}
