import { describe, expect, test } from 'vitest'
import { alertCopyFor, normalizeAlertKind } from '../../../supabase/functions/_shared/alert-copy'
import { renderSilboAlertEmail } from '../../../supabase/functions/_shared/email-template'

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
})
