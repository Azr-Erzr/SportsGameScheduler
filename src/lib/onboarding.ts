// First-run onboarding flag. The 20-second "pick your sports + confirm your timezone" flow runs
// once for a brand-new visitor, then never again. Stored separately from follows/prefs so a user
// who clears their picks but keeps the flag isn't re-onboarded.

const KEY = 'mp.onboarded'

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // storage blocked → don't nag
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}
