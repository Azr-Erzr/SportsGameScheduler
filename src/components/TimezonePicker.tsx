import { useEffect, useId, useRef, useState } from 'react'
import { Check, Clock3 } from 'lucide-react'
import {
  searchZones,
  zoneCityLabel,
  zoneOffsetLabel,
  zoneRegion,
  type TimeZoneOption,
} from '../lib/timezones'

// Searchable timezone selector backed by the full IANA list (src/lib/timezones.ts). Picking a zone
// is the source of truth — the schedule and world clock render in it — and the city is just its
// label. Fixes the old free-text trap where typing an unknown city left the timezone silently wrong.

export function TimezonePicker({
  zone,
  onSelect,
  className = '',
}: {
  zone: string
  onSelect: (zone: string) => void
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()

  const results = open && query.trim() ? searchZones(query, 8) : []
  const activeIndex = results.length ? Math.min(active, results.length - 1) : 0

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(option: TimeZoneOption) {
    onSelect(option.zone)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false)
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const choice = results[activeIndex]
      if (choice) choose(choice)
    }
  }

  const currentLabel = `${zoneCityLabel(zone)} · ${zoneRegion(zone)}`
  const currentOffset = zoneOffsetLabel(zone)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <label className="flex items-center gap-2 rounded-lg border border-primary/20 bg-surface px-3 py-2">
        <Clock3 size={16} className="shrink-0 text-primary" />
        <input
          value={open ? query : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={`${currentLabel}${currentOffset ? ` (${currentOffset})` : ''}`}
          aria-label="Search city or timezone"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-ink/70"
        />
      </label>

      {open && query.trim() && (
        <div
          id={listId}
          role="listbox"
          className="silbo-popover-panel absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-primary/20 bg-surface p-1.5 shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink/50">No city or timezone matches “{query.trim()}”.</p>
          ) : (
            results.map((option, index) => {
              const offset = zoneOffsetLabel(option.zone)
              const selected = option.zone === zone
              const aliasNote = option.aliases.length ? ` · ${option.aliases.slice(0, 3).join(', ')}` : ''
              return (
                <button
                  key={option.zone}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    index === activeIndex ? 'bg-primary/12' : 'hover:bg-primary/8'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {option.label} <span className="font-normal text-ink/45">{option.region}</span>
                    </span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-ink/45">
                      {offset}
                      {aliasNote}
                    </span>
                  </span>
                  {selected && <Check size={15} className="shrink-0 text-primary" />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
