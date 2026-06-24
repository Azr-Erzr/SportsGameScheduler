import { getSport } from '../domain/sports'

// Sport run-times + overlap tiers. Mirrors docs/event-timing-and-overlaps.md — keep them in sync.
// "typical" = median wall-clock length of one event (what blocks a viewer's evening); used as the
// overlap window. "hardCap" = generous upper bound. allDay sports (golf/cycling) never raise a hard
// overlap against a *different* sport — at most "close" (on in the background).

export type SportTiming = { typicalMin: number; hardCapMin: number; allDay?: boolean }

const TIMING: Record<string, SportTiming> = {
  soccer: { typicalMin: 115, hardCapMin: 150 },
  basketball: { typicalMin: 140, hardCapMin: 180 },
  american_football: { typicalMin: 195, hardCapMin: 240 },
  hockey: { typicalMin: 150, hardCapMin: 195 },
  baseball: { typicalMin: 165, hardCapMin: 240 },
  tennis: { typicalMin: 150, hardCapMin: 300 },
  golf: { typicalMin: 300, hardCapMin: 480, allDay: true },
  motorsport: { typicalMin: 120, hardCapMin: 180 },
  combat_sports: { typicalMin: 300, hardCapMin: 360 },
  athletics: { typicalMin: 150, hardCapMin: 210 },
  olympic_sports: { typicalMin: 150, hardCapMin: 240 },
  cricket: { typicalMin: 210, hardCapMin: 480 },
  rugby: { typicalMin: 105, hardCapMin: 130 },
  volleyball: { typicalMin: 110, hardCapMin: 150 },
  handball: { typicalMin: 80, hardCapMin: 100 },
  cycling: { typicalMin: 300, hardCapMin: 420, allDay: true },
  snooker: { typicalMin: 180, hardCapMin: 480 },
  darts: { typicalMin: 120, hardCapMin: 240 },
  esports: { typicalMin: 120, hardCapMin: 300 },
}

const DEFAULT_TIMING: SportTiming = { typicalMin: 120, hardCapMin: 180 }
const CLOSE_MARGIN_MS = 20 * 60 * 1000 // ±20 min "just clips / just misses" buffer

// Accepts a route key (soccer, combat) or a canonical key (combat_sports) and resolves to timing.
export function sportTiming(sportKey?: string | null): SportTiming {
  if (!sportKey) return DEFAULT_TIMING
  const canonical = getSport(sportKey)?.canonicalSportKey ?? sportKey
  return TIMING[canonical] ?? TIMING[sportKey] ?? DEFAULT_TIMING
}

export type OverlapTier = 'overlap' | 'close'
type TimedSportItem = { start: number; sportKey?: string | null }

// Tier for two events: 'overlap' (true clash — same start or windows intersect past the margin),
// 'close' (windows just clip or just miss — heads-up), or null (clear).
export function overlapTier(a: TimedSportItem, b: TimedSportItem): OverlapTier | null {
  const [first, second] = a.start <= b.start ? [a, b] : [b, a]
  const tFirst = sportTiming(first.sportKey)
  const tSecond = sportTiming(second.sportKey)
  const differentSport = (first.sportKey ?? '') !== (second.sportKey ?? '')

  const gapMs = second.start - (first.start + tFirst.typicalMin * 60_000)
  let tier: OverlapTier | null
  if (first.start === second.start || gapMs <= -CLOSE_MARGIN_MS) tier = 'overlap'
  else if (gapMs <= CLOSE_MARGIN_MS) tier = 'close'
  else tier = null

  // An all-day sport (golf/cycling) shouldn't hard-clash a different sport — soften to "close".
  if (tier === 'overlap' && differentSport && (tFirst.allDay || tSecond.allDay)) tier = 'close'
  return tier
}

// Strongest-conflict tier per item index. 'overlap' beats 'close'. Pairwise within a hard-cap
// window (a sweep that stops once a candidate starts beyond the earlier event's hard cap).
export function findConflictTiers<T extends { startsAt: Date; sportKey?: string | null }>(
  items: T[],
): Map<number, OverlapTier> {
  const order = items
    .map((item, index) => ({ index, start: item.startsAt.getTime(), sportKey: item.sportKey }))
    .sort((a, b) => a.start - b.start)
  const result = new Map<number, OverlapTier>()
  const bump = (index: number, tier: OverlapTier) => {
    if (tier === 'overlap' || !result.has(index)) result.set(index, tier)
  }

  for (let i = 0; i < order.length; i++) {
    const a = order[i]
    const aCapEnd = a.start + sportTiming(a.sportKey).hardCapMin * 60_000
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j]
      if (b.start > aCapEnd) break // sorted: nothing further can clip A
      const tier = overlapTier(a, b)
      if (tier) {
        bump(a.index, tier)
        bump(b.index, tier)
      }
    }
  }
  return result
}
