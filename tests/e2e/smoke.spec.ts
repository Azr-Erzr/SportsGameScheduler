import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const smokeRoutes = [
  { path: '/', landmark: /one schedule for every sport you follow/i },
  { path: '/my-schedule', landmark: /my schedule|world cup schedule/i },
  { path: '/other-sports', landmark: /provider-backed routes|find a sport/i },
  { path: '/sports/soccer', landmark: /soccer|world cup/i },
  { path: '/sports/baseball', landmark: /baseball/i },
]

test.describe('core route smoke', () => {
  for (const route of smokeRoutes) {
    test(`${route.path} renders without console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('response', (response) => {
        if (response.status() === 404 && response.url().includes('/rpc/spotlight_ranked')) return
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
      })
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text())
      })

      await page.goto(route.path)
      await expect(page.locator('body')).toContainText(route.landmark)
      await expect(page.locator('main')).toBeVisible()
      expect(errors).toEqual([])
    })
  }
})

test.describe('accessibility smoke', () => {
  test('home and schedule have no serious automated a11y violations', async ({ page }) => {
    for (const path of ['/', '/my-schedule']) {
      await page.goto(path)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze()
      const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
      expect(serious, `${path} serious a11y violations`).toEqual([])
    }
  })
})
