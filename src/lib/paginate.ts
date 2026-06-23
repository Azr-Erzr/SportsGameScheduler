// Export pagination (Objective 8): photo exports must never become tiny unreadable text,
// so long schedules split into multiple readable pages.

export const MAX_EVENTS_BY_TEMPLATE = {
  story: 7,
  poster: 9,
  compact: 12,
  family: 6,
} as const

export type ExportTemplate = keyof typeof MAX_EVENTS_BY_TEMPLATE

export function paginateEvents<T>(events: T[], template: ExportTemplate): T[][] {
  const size = MAX_EVENTS_BY_TEMPLATE[template]
  const pages: T[][] = []

  for (let i = 0; i < events.length; i += size) {
    pages.push(events.slice(i, i + size))
  }

  return pages
}

// Image/poster pagination: interior pages (not first or last) carry one extra event because the
// poster renderer slims their header and drops the footer. Denser middle pages, often one fewer
// page overall — better efficiency and aesthetics for multi-page exports.
export function paginateEventsForPoster<T>(events: T[], template: ExportTemplate): T[][] {
  const base = MAX_EVENTS_BY_TEMPLATE[template]
  if (events.length === 0) return []
  if (events.length <= base) return [events]

  const pages: T[][] = [events.slice(0, base)]
  let i = base
  while (i < events.length) {
    const remaining = events.length - i
    if (remaining <= base + 1) {
      pages.push(events.slice(i)) // final (footered) page
      break
    }
    pages.push(events.slice(i, i + base + 1)) // interior page: +1
    i += base + 1
  }
  return pages
}
