import { describe, expect, test } from 'vitest'
import { alertCopyFor, normalizeAlertKind } from '../../../supabase/functions/_shared/alert-copy'
import { AFFILIATE_DISCLOSURE, renderSilboAlertEmail } from '../../../supabase/functions/_shared/email-template'
import { buildTicketmasterEmailLink } from '../../../supabase/functions/_shared/ticket-links'

describe('alert copy', () => {
  test('renders participant/bracket updates as matchup-set alerts', () => {
    const copy = alertCopyFor(
      'bracket_slot_set',
      {
        title: '1A vs 3C/E/F/H/I',
        starts_at: '2026-07-01T01:00:00.000Z',
        venue_name: 'Mexico City',
        league_name: 'FIFA World Cup',
      },
      'https://silbosports.com/settings/alerts',
    )

    expect(normalizeAlertKind('bracket_slot_set')).toBe('participant_update')
    expect(copy.subject).toBe('Matchup set: 1A vs 3C/E/F/H/I')
    expect(copy.body).toContain('teams, players, or bracket slots')
    expect(copy.body).toContain('League: FIFA World Cup')
    expect(copy.body).toContain('Manage alerts: https://silbosports.com/settings/alerts')
  })

  test('keeps where-to-watch updates distinct from time changes', () => {
    const copy = alertCopyFor('broadcast_set', { title: 'UFC 329' }, 'https://silbosports.com/settings/alerts')

    expect(normalizeAlertKind('broadcast_set')).toBe('broadcast_update')
    expect(copy.subject).toBe('Watch info updated: UFC 329')
    expect(copy.body).toContain('where-to-watch information')
  })

  test('renders branded html and text email fallbacks', () => {
    const event = {
      title: 'Canada vs Morocco',
      starts_at: '2026-06-18T22:00:00.000Z',
      timezone: 'America/Toronto',
      venue_name: 'BMO Field',
      league_name: 'FIFA World Cup',
    }
    const copy = alertCopyFor('reminder', event, 'https://silbosports.com/settings/alerts')
    const email = renderSilboAlertEmail({
      appUrl: 'https://silbosports.com',
      copy,
      event,
      manageUrl: 'https://silbosports.com/settings/alerts',
    })

    expect(email.subject).toBe('Reminder: Canada vs Morocco')
    expect(email.text).toContain('Manage alerts: https://silbosports.com/settings/alerts')
    expect(email.text).toContain('League: FIFA World Cup')
    expect(email.html).toContain('Silbo Sports')
    expect(email.html).toContain('View event')
    expect(email.html).toContain('BMO Field')
  })

  test('renders an event-specific paid Ticketmaster link with an adjacent disclosure', () => {
    const event = {
      title: 'Buffalo Bills vs Miami Dolphins',
      starts_at: '2026-09-20T17:00:00.000Z',
      timezone: 'America/New_York',
      venue_name: 'Highmark Stadium',
      league_name: 'NFL',
    }
    const copy = alertCopyFor('new_event', event, 'https://silbosports.com/settings/alerts')
    const ticket = buildTicketmasterEmailLink({
      trackingUrl: 'https://ticketmaster.evyy.net/c/7423477/123456/4272',
      region: 'US',
      title: event.title,
      leagueName: event.league_name,
      venue: event.venue_name,
      eventId: 'event-123',
      placement: 'email-new-event',
    })
    const email = renderSilboAlertEmail({
      appUrl: 'https://silbosports.com',
      copy,
      event,
      manageUrl: 'https://silbosports.com/settings/alerts',
      ticket,
    })

    expect(ticket).not.toBeNull()
    expect(email.text).toContain('Tickets (paid link): Ticketmaster')
    expect(email.text).toContain(AFFILIATE_DISCLOSURE)
    expect(email.html).toContain('Check Ticketmaster')
    expect(email.html).toContain('<strong>Paid link:</strong>')
    expect(ticket?.url).toContain('subId1=email-new-event')
    expect(ticket?.url).toContain('subId2=event-123')
  })
})
