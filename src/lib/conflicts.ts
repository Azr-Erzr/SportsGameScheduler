// Schedule conflict detection (Objective 14.3): flag events in a personal schedule that
// overlap in time, so the user can decide what to actually watch.

export type TimedItem = { startsAt: Date }

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

/**
 * Returns the set of indexes (into the input array) that overlap at least one other item,
 * assuming each item runs for `durationMs` from its start. Input does not need to be sorted.
 */
export function findConflicts<T extends TimedItem>(
  items: T[],
  durationMs: number = DEFAULT_DURATION_MS,
): Set<number> {
  const conflicted = new Set<number>()
  const order = items
    .map((item, index) => ({ index, start: item.startsAt.getTime() }))
    .sort((a, b) => a.start - b.start)

  for (let i = 1; i < order.length; i++) {
    const prev = order[i - 1]
    const curr = order[i]
    if (curr.start < prev.start + durationMs) {
      conflicted.add(prev.index)
      conflicted.add(curr.index)
    }
  }

  return conflicted
}
