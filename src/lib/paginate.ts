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
