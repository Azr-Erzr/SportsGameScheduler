import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const smokeRoutes = [
  { path: '/', landmark: /one schedule for every sport you follow/i },
  { path: '/my-schedule', landmark: /my schedule|world cup schedule/i },
  { path: '/exports', landmark: /silbo exports|live sync|static packs/i },
  { path: '/custom-leagues', landmark: /community schedules|create a league/i },
  { path: '/other-sports', landmark: /provider-backed routes|find a sport/i },
]

const mainSportRoutes = [
  { path: '/sports/soccer', landmark: /soccer|world cup/i },
  { path: '/sports/basketball', landmark: /basketball/i },
  { path: '/sports/football', landmark: /american football/i },
  { path: '/sports/hockey', landmark: /hockey/i },
  { path: '/sports/tennis', landmark: /tennis/i },
  { path: '/sports/golf', landmark: /golf/i },
  { path: '/sports/motorsport', landmark: /motorsport/i },
  { path: '/sports/combat', landmark: /combat sports/i },
  { path: '/sports/track', landmark: /track & field/i },
  { path: '/sports/olympic', landmark: /olympic sports/i },
  { path: '/sports/baseball', landmark: /baseball/i },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mp.onboarded', '1')
  })
})

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

test.describe('main sport route smoke', () => {
  for (const route of mainSportRoutes) {
    test(`${route.path} has a hydrated display surface`, async ({ page }) => {
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
      await expect(page.getByRole('link', { name: /sync schedule/i })).toBeVisible()
      await expect(page.locator('main')).toBeVisible()
      await expect(page.locator('body')).not.toContainText(/schedule unavailable/i)
      expect(errors).toEqual([])
    })
  }
})

test.describe('match card interactions', () => {
  test('a schedule card expands to show event details and the watch slot', async ({ page }) => {
    await page.goto('/sports/soccer')

    const firstDetailsToggle = page.getByRole('button', { name: /expand details for/i }).first()
    await expect(firstDetailsToggle).toBeVisible()
    await firstDetailsToggle.click()

    await expect(page.getByText(/match details/i).first()).toBeVisible()
    await expect(page.getByText(/where to watch/i).first()).toBeVisible()
  })
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
