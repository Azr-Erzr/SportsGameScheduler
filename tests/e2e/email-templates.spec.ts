import { expect, test } from '@playwright/test'

test.describe('email template presentation', () => {
  for (const template of [
    { path: '/supabase/templates/magic-link.html', heading: /step back into your schedule/i },
    { path: '/supabase/templates/confirm-signup.html', heading: /confirm your place on the board/i },
  ]) {
    test(`${template.path} stays readable at the project viewport`, async ({ page }) => {
      await page.goto(template.path)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(template.heading)
      await expect(page.locator('.primary-button')).toBeVisible()

      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        panel: document.querySelector('.panel')?.getBoundingClientRect().width ?? 0,
      }))
      expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport)
      expect(dimensions.panel).toBeLessThanOrEqual(Math.min(600, dimensions.viewport))
    })
  }
})
