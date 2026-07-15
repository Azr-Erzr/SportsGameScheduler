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

test.describe('adaptive presentation', () => {
  test('desktop homepage artwork stays edge-anchored and spans ultrawide gutters', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop responsive-art regression')

    const samples: Array<{ viewport: number; sideWidth: number }> = []
    for (const viewport of [960, 1440, 1920, 2560, 3440]) {
      await page.setViewportSize({ width: viewport, height: 1000 })
      await page.goto('/')
      await expect.poll(() => page.locator('html').getAttribute('data-browser')).toBe('enhanced')

      const geometry = await page.evaluate(() => {
        const left = document.querySelector<HTMLElement>('.crt-side-signal-left')!.getBoundingClientRect()
        const right = document.querySelector<HTMLElement>('.crt-side-signal-right')!.getBoundingClientRect()
        const leftTrace = document.querySelector<HTMLElement>('.crt-side-signal-left .crt-signal-trace')!.getBoundingClientRect()
        const leftPixel = document.querySelector<HTMLElement>('.crt-side-signal-left .crt-pixel-cyan')!.getBoundingClientRect()
        const rightPixel = document.querySelector<HTMLElement>('.crt-side-signal-right .crt-pixel-cyan')!.getBoundingClientRect()
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          left: { x: left.x, right: left.right, width: left.width },
          right: { x: right.x, right: right.right, width: right.width },
          leftTrace: { x: leftTrace.x, right: leftTrace.right },
          leftPixelX: leftPixel.x,
          rightPixelGap: window.innerWidth - rightPixel.right,
        }
      })

      expect(geometry.documentWidth, `${viewport}px should not overflow horizontally`).toBeLessThanOrEqual(
        geometry.viewportWidth,
      )
      expect(geometry.left.x).toBeLessThanOrEqual(14)
      expect(viewport - geometry.right.right).toBeLessThanOrEqual(14)
      expect(geometry.leftPixelX).toBeLessThanOrEqual(120)
      expect(geometry.rightPixelGap).toBeLessThanOrEqual(120)
      expect(geometry.leftTrace.x).toBeLessThanOrEqual(80)

      if (viewport >= 1920) {
        const gutter = (viewport - 1460) / 2
        expect(geometry.left.right - gutter, `${viewport}px artwork should overlap the content rail`).toBeGreaterThanOrEqual(175)
        expect(geometry.leftTrace.right, `${viewport}px trace should cross the outer gutter`).toBeGreaterThan(gutter)
      }

      samples.push({ viewport, sideWidth: geometry.left.width })
    }

    expect(samples.map(({ sideWidth }) => Math.round(sideWidth))).toEqual([260, 260, 422, 806, 1270])
  })

  test('desktop homepage CRT artwork loops on long scrolls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop scroll-motion regression')

    await page.goto('/')
    await expect(page.getByRole('heading', { name: /one schedule for every sport you follow/i })).toBeVisible()
    const legLength = await page.evaluate(() => Math.max(1200, window.innerHeight * 1.75))
    await expect
      .poll(() =>
        page.evaluate(() => ({
          browser: document.documentElement.dataset.browser,
          effects: document.documentElement.dataset.visualEffects,
          initialized: getComputedStyle(document.documentElement).getPropertyValue('--crt-side-left-x').trim() !== '',
        })),
      )
      .toEqual({ browser: 'enhanced', effects: 'enhanced', initialized: true })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight))
      .toBeGreaterThanOrEqual(legLength * 2)

    const sampleLeftOffset = async (scrollY: number) => {
      await page.evaluate((top) => {
        window.scrollTo({ top, behavior: 'instant' })
        window.dispatchEvent(new Event('scroll'))
      }, scrollY)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollY, 0)
      return expect
        .poll(() =>
          page.evaluate(() =>
            Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--crt-side-left-x')),
          ),
        )
    }

    await (await sampleLeftOffset(legLength / 2)).toBeCloseTo(-55, 0)
    await (await sampleLeftOffset(legLength)).toBeCloseTo(-110, 0)
    await (await sampleLeftOffset(legLength * 1.5)).toBeCloseTo(-55, 0)
    await (await sampleLeftOffset(legLength * 2)).toBeCloseTo(0, 0)
  })

  test('system theme changes are followed until the visitor chooses explicitly', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect.poll(() => page.locator('html').getAttribute('data-surface')).toBe('broadcast')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => page.locator('html').getAttribute('data-surface')).toBe('program')

    await page.getByRole('button', { name: /switch to broadcast dark/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-surface', 'broadcast')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-surface', 'broadcast')
  })

  test('mobile routes stay within the viewport and use the static effects path', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile presentation regression')

    for (const path of ['/', '/sports/basketball', '/other-sports']) {
      await page.goto(path)
      const presentation = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        effects: document.documentElement.dataset.visualEffects,
        liveSignals: [...document.querySelectorAll<HTMLElement>('.page-signal-live')].filter(
          (element) => getComputedStyle(element).display !== 'none',
        ).length,
      }))

      expect(presentation.documentWidth, `${path} should not overflow horizontally`).toBeLessThanOrEqual(
        presentation.viewportWidth,
      )
      expect(presentation.effects).toBe('reduced')
      expect(presentation.liveSignals).toBe(0)
    }
  })
})
