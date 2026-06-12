import { describe, expect, test } from 'vitest'
import { escapeIcsText } from '../ics'

describe('escapeIcsText (RFC 5545 §3.3.11)', () => {
  test('escapes backslash first, then structural characters', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })

  test('converts newlines to literal \\n', () => {
    expect(escapeIcsText('line1\nline2\r\nline3')).toBe('line1\\nline2\\nline3')
  })

  test('passes plain text through unchanged', () => {
    expect(escapeIcsText('Mexico vs South Africa')).toBe('Mexico vs South Africa')
  })

  test('venue names with commas no longer break LOCATION fields', () => {
    expect(escapeIcsText('Estadio Azteca, Mexico City')).toBe('Estadio Azteca\\, Mexico City')
  })
})
