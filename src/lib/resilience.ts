// Read-path resilience for the live schedule. The board reads Supabase directly from the browser
// with the publishable key. A single transient failure (5xx, network blip, or rate-limiting during
// the ingestion write-bursts) used to resolve to `data ?? []`, blanking the WHOLE board with no
// retry and no fallback — the "all the data disappeared" reports. These two primitives fix that:
//
//   retryRead  — retries a Supabase read a few times with backoff, and THROWS if every attempt
//                fails (so callers can tell "genuinely empty" apart from "request failed" and keep
//                showing the last good data instead of wiping it).
//   read/writeCache — a tiny localStorage stale-while-revalidate cache so a cold load or a failed
//                refresh still paints real fixtures instead of an empty state.

type SupabaseResult<T> = { data: T | null; error: unknown }

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Run a Supabase query builder (re-invoked each attempt) with exponential backoff + jitter. Resolves
// with the data on the first success; throws the last error if all attempts fail. PostgREST builders
// are thenable and single-shot, so callers pass a factory that builds a fresh query per attempt.
export async function retryRead<T>(build: () => PromiseLike<SupabaseResult<T>>, attempts = 3): Promise<T | null> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const { data, error } = await build()
      if (!error) return data
      lastError = error
    } catch (caught) {
      lastError = caught
    }
    if (attempt < attempts - 1) await delay(250 * 2 ** attempt + Math.floor(Math.random() * 120))
  }
  throw lastError ?? new Error('read failed')
}

const CACHE_PREFIX = 'mp.cache.'

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return (JSON.parse(raw) as { v: T }).v ?? null
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    // storage full / unavailable (private mode) — the cache is best-effort, never required.
  }
}
