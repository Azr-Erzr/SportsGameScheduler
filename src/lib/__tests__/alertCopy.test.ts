import { describe, expect, test } from 'vitest'
import { alertCopyFor, normalizeAlertKind } from '../../../supabase/functions/_shared/alert-copy'

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
})
