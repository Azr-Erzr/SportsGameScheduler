export const ALERT_KINDS = [
  'reminder',
  'time_change',
  'time_set',
  'cancellation',
  'new_event',
  'participant_update',
  'venue_change',
  'broadcast_update',
] as const

export type AlertKind = (typeof ALERT_KINDS)[number]

export type AlertCopyEvent = {
  title: string
  starts_at?: string | null
  timezone?: string | null
  venue_name?: string | null
  league_name?: string | null
}

export type AlertCopy = {
  subject: string
  lead: string
  body: string
}

export const ALERT_KIND_COPY: Record<AlertKind, { label: string; settingLabel: string; description: string }> = {
  reminder: {
    label: 'Start reminder',
    settingLabel: 'Start reminders',
    description: 'Send a reminder before a scheduled event begins.',
  },
  time_change: {
    label: 'Time changed',
    settingLabel: 'Time changes',
    description: 'Kickoffs, tipoffs, race starts, tee times, card starts, or session times move.',
  },
  time_set: {
    label: 'Time confirmed',
    settingLabel: 'Times confirmed',
    description: 'A TBD time becomes a real start time.',
  },
  cancellation: {
    label: 'Cancelled or postponed',
    settingLabel: 'Cancellations and postponements',
    description: 'An event is cancelled, postponed, or materially removed from the active schedule.',
  },
  new_event: {
    label: 'New event',
    settingLabel: 'New events',
    description: 'A new match, race, card, round, or session is added for something you follow.',
  },
  participant_update: {
    label: 'Matchup set',
    settingLabel: 'Teams, players, and bracket slots',
    description: 'A draw, bracket slot, fight card, or TBD participant is filled in.',
  },
  venue_change: {
    label: 'Venue changed',
    settingLabel: 'Venue changes',
    description: 'A venue, host city, court, track, course, or arena changes.',
  },
  broadcast_update: {
    label: 'Watch info updated',
    settingLabel: 'Where-to-watch updates',
    description: 'TV, streaming, radio, ticket, or official watch links are added or changed.',
  },
}

function eventDetails(event: AlertCopyEvent) {
  return [
    event.league_name ? `League: ${event.league_name}` : '',
    event.starts_at ? `Start: ${new Date(event.starts_at).toUTCString()}` : '',
    event.venue_name ? `Venue: ${event.venue_name}` : '',
  ].filter(Boolean)
}

export function normalizeAlertKind(kind: string): AlertKind {
  if ((ALERT_KINDS as readonly string[]).includes(kind)) return kind as AlertKind
  if (kind === 'participant_set' || kind === 'bracket_slot_set' || kind === 'draw_set') return 'participant_update'
  if (kind === 'venue_set') return 'venue_change'
  if (kind === 'broadcast_set' || kind === 'watch_link_update') return 'broadcast_update'
  return 'time_change'
}

export function alertCopyFor(kindInput: string, event: AlertCopyEvent, manageUrl: string): AlertCopy {
  const kind = normalizeAlertKind(kindInput)
  const title = event.title
  const subject =
    kind === 'reminder'
      ? `Reminder: ${title}`
      : kind === 'time_change'
        ? `New time: ${title}`
        : kind === 'time_set'
          ? `Time confirmed: ${title}`
          : kind === 'cancellation'
            ? `Schedule change: ${title}`
            : kind === 'new_event'
              ? `New event: ${title}`
              : kind === 'participant_update'
                ? `Matchup set: ${title}`
                : kind === 'venue_change'
                  ? `Venue update: ${title}`
                  : `Watch info updated: ${title}`

  const lead =
    kind === 'reminder'
      ? `${title} starts soon.`
      : kind === 'time_change'
        ? `${title} has a new start time.`
        : kind === 'time_set'
          ? `${title} now has a confirmed start time.`
          : kind === 'cancellation'
            ? `${title} was cancelled or postponed.`
            : kind === 'new_event'
              ? `${title} was added to the schedule.`
              : kind === 'participant_update'
                ? `${title} now has updated teams, players, or bracket slots.`
                : kind === 'venue_change'
                  ? `${title} has an updated venue.`
                  : `${title} has updated where-to-watch information.`

  const details = eventDetails(event)
  return {
    subject,
    lead,
    body: [lead, ...details, '', `Manage alerts: ${manageUrl}`].join('\n'),
  }
}
