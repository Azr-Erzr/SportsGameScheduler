type RateLimitOptions = {
  limit: number
  windowMs: number
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function clientIp(req: Request) {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

function pruneExpired(now: number) {
  if (buckets.size < 1_000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function rateLimitKey(req: Request, scope: string, tokenHash?: string) {
  return `${scope}:${clientIp(req)}:${tokenHash?.slice(0, 16) ?? 'anon'}`
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now()
  pruneExpired(now)
  const current = buckets.get(key)
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current
  bucket.count += 1
  buckets.set(key, bucket)

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000))
  return {
    allowed: bucket.count <= options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    retryAfterSeconds,
  }
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return new Response('Too many requests', {
    status: 429,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'retry-after': String(retryAfterSeconds),
      'cache-control': 'no-store',
    },
  })
}
