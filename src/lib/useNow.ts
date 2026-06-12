import { useSyncExternalStore } from 'react'

// The wall clock as an external store. Snapshot is quantized to the refresh interval so it
// is stable between ticks (render-pure), and subscribers re-render once per tick.
export function useNow(intervalMs = 60_000): number {
  return useSyncExternalStore(
    (onTick) => {
      const id = setInterval(onTick, intervalMs)
      return () => clearInterval(id)
    },
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
  )
}
