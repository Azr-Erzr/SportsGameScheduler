const MIN_SCROLL_LEG_PX = 1200
const VIEWPORTS_PER_SCROLL_LEG = 1.75

/**
 * Returns a smooth 0 -> 1 -> 0 progress value that keeps repeating as the page scrolls.
 * The return leg avoids a visible jump when fixed CRT artwork wraps on very long pages.
 */
export function getLoopingScrollProgress(scrollY: number, viewportHeight: number) {
  const safeScrollY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(1, viewportHeight) : 1
  const legLength = Math.max(MIN_SCROLL_LEG_PX, safeViewportHeight * VIEWPORTS_PER_SCROLL_LEG)
  const phase = (safeScrollY / legLength) % 2

  return phase <= 1 ? phase : 2 - phase
}
