import { describe, expect, test } from 'vitest'
import { isPublicLeagueName } from '../liveSport'

describe('isPublicLeagueName', () => {
  test('hides internal or retired league buckets', () => {
    expect(isPublicLeagueName('_Defunct Ice Hockey Teams')).toBe(false)
    expect(isPublicLeagueName('Deprecated Golf Fixtures')).toBe(false)
    expect(isPublicLeagueName('Placeholder League')).toBe(false)
  })

  test('keeps real public league names', () => {
    expect(isPublicLeagueName('NHL')).toBe(true)
    expect(isPublicLeagueName('ATP World Tour')).toBe(true)
    expect(isPublicLeagueName('Test Cricket')).toBe(true)
  })
})
