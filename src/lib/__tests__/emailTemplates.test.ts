import { describe, expect, test } from 'vitest'
import confirmSignupHtml from '../../../supabase/templates/confirm-signup.html?raw'
import magicLinkHtml from '../../../supabase/templates/magic-link.html?raw'

describe('Supabase auth email templates', () => {
  test.each([
    ['magic-link.html', magicLinkHtml],
    ['confirm-signup.html', confirmSignupHtml],
  ])('%s keeps auth tokens and CRT fallbacks intact', (_file, html) => {
    expect(html).toContain('<!doctype html>')
    expect(html.match(/{{ \.ConfirmationURL }}/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('content="light only"')
    expect(html).toContain('background-color:#f3eddd')
    expect(html).toContain('background-color:#171b18')
    expect(html).toContain('#54ff9f')
    expect(html).toContain('#45c7d4')
    expect(html).toContain('#ef6baf')
    expect(html).toContain('#f0b93f')
    expect(html).toContain('class="primary-button"')
    expect(html).toContain('@media only screen and (max-width:480px)')
  })
})
