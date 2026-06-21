import { useSyncExternalStore } from 'react'

// The wall clock as an external store. Snapshot is quantized to the refresh interval so it
// is stable between ticks (render-pure), and subscribers re-render once per tick. Stores are
// shared per interval so multiple clock/schedule components do not each spin up their own timer.
type ClockStore = {
  subscribers: Set<() => void>
  value: number
  timer: ReturnType<typeof setInterval> | null
}

const stores = new Map<number, ClockStore>()

function quantize(intervalMs: number) {
  return Math.floor(Date.now() / intervalMs) * intervalMs
}

function getStore(intervalMs: number) {
  let store = stores.get(intervalMs)
  if (!store) {
    store = { subscribers: new Set(), value: quantize(intervalMs), timer: null }
    stores.set(intervalMs, store)
  }
  return store
}

function readSnapshot(intervalMs: number) {
  const store = getStore(intervalMs)
  const next = quantize(intervalMs)
  if (next !== store.value) store.value = next
  return store.value
}

export function useNow(intervalMs = 60_000): number {
  return useSyncExternalStore(
    (onTick) => {
      const store = getStore(intervalMs)
      store.subscribers.add(onTick)
      if (!store.timer) {
        store.timer = setInterval(() => {
          const next = quantize(intervalMs)
          if (next === store.value) return
          store.value = next
          store.subscribers.forEach((subscriber) => subscriber())
        }, intervalMs)
      }
      return () => {
        store.subscribers.delete(onTick)
        if (store.subscribers.size === 0 && store.timer) {
          clearInterval(store.timer)
          store.timer = null
        }
      }
    },
    () => readSnapshot(intervalMs),
  )
}
