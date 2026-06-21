export type ExportAdviceMethod = 'pdf' | 'image' | 'share' | 'csv' | 'ics' | 'live' | 'one_time_calendar'

export type ExportAdvice = {
  tone: 'good' | 'info' | 'warn'
  title: string
  body: string
}

type ExportAdviceInput = {
  method: ExportAdviceMethod
  eventCount: number
  pageCount?: number
  hasLiveFollows?: boolean
  liveEventCount?: number
  includesChangingDetails?: boolean
}

const LONG_EXPORT_PAGE_LIMIT = 3
const DENSE_EVENT_LIMIT = 24
const VERY_DENSE_EVENT_LIMIT = 48

export function buildExportAdvice({
  method,
  eventCount,
  pageCount = 0,
  hasLiveFollows = false,
  liveEventCount = 0,
  includesChangingDetails = false,
}: ExportAdviceInput): ExportAdvice | null {
  if (eventCount === 0) return null

  const hasLongStaticExport = pageCount > LONG_EXPORT_PAGE_LIMIT
  const isStaticVisual = method === 'pdf' || method === 'image' || method === 'share'
  const isDense = eventCount >= DENSE_EVENT_LIMIT
  const liveCopy = hasLiveFollows
    ? 'Silbo Sync is cleaner because it keeps your followed sports in one updating calendar feed.'
    : 'An ICS file will be easier to search, sort, and manage in a calendar.'

  if (isStaticVisual && hasLongStaticExport) {
    return {
      tone: 'warn',
      title: 'This export will be long',
      body: `${pageCount} pages at the current layout. ${liveCopy}`,
    }
  }

  if (isStaticVisual && isDense) {
    return {
      tone: 'info',
      title: 'A calendar may handle this better',
      body: `${eventCount} events is a lot to scan in static pages. ICS is usually the better tracking format, with PDF or images as a backup.`,
    }
  }

  if (method === 'csv' && isDense) {
    return {
      tone: 'info',
      title: 'CSV is best for editing',
      body: `${eventCount} events will work in a spreadsheet, but ICS is better for actually following the schedule day to day.`,
    }
  }

  if (method === 'ics' && (eventCount >= VERY_DENSE_EVENT_LIMIT || includesChangingDetails || hasLiveFollows)) {
    return {
      tone: includesChangingDetails || hasLiveFollows ? 'info' : 'good',
      title: 'ICS is the right static format',
      body: includesChangingDetails || hasLiveFollows
        ? `This is manageable as an ICS file, but live sync is better if times, TBD slots, or provider details may change.`
        : `${eventCount} events is dense, and a calendar file will stay far easier to use than static pages.`,
    }
  }

  if (method === 'one_time_calendar' && (includesChangingDetails || hasLiveFollows || eventCount >= DENSE_EVENT_LIMIT)) {
    return {
      tone: 'info',
      title: 'One-time imports can go stale',
      body: `This adds ${eventCount} events now. Use a live calendar feed when you want changes and new details to keep landing automatically.`,
    }
  }

  if (method === 'live' && liveEventCount > 0) {
    return {
      tone: 'good',
      title: 'Best fit for changing schedules',
      body: `${liveEventCount} live events can stay in one feed, so you are not re-exporting every time details change.`,
    }
  }

  return null
}

export const exportAdviceThresholds = {
  longExportPageLimit: LONG_EXPORT_PAGE_LIMIT,
  denseEventLimit: DENSE_EVENT_LIMIT,
}
