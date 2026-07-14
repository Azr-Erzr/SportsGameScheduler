import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Goal, Search, Trophy, User, Users } from 'lucide-react'
import { useGlobalSearch, type SearchResultKind } from '../data/search'

// Cross-sport search field with a results dropdown. Self-contained: owns its own query state and
// navigates on select. Drop it anywhere a "find anything" entry point is useful (Home, Explore).

const KIND_ICON: Record<SearchResultKind, typeof Search> = {
  sport: Trophy,
  league: Users,
  team: Goal,
  competitor: User,
}

export function GlobalSearch({ placeholder, autoFocus }: { placeholder: string; autoFocus?: boolean }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { results, loading } = useGlobalSearch(query)
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  // Clamp in render so a shrinking result set can't leave `active` out of range (no effect needed).
  const activeIndex = results.length ? Math.min(active, results.length - 1) : 0

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function go(to: string) {
    navigate(to)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
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
      if (choice) go(choice.to)
    }
  }

  const showDropdown = open && query.trim().length >= 1

  return (
    <div ref={ref} className="relative">
      <label className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 shadow-sm">
        <Search size={18} className="text-ink/40" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="silbo-popover-panel absolute left-0 right-0 z-40 mt-2 max-h-80 overflow-y-auto rounded-xl border border-primary/20 bg-surface p-1.5 shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink/50">
              {loading ? 'Searching…' : query.trim().length < 2 ? 'Keep typing to search every sport…' : `No matches for “${query.trim()}”.`}
            </p>
          ) : (
            results.map((result, index) => {
              const Icon = KIND_ICON[result.kind]
              return (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result.to)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    index === activeIndex ? 'bg-primary/12' : 'hover:bg-primary/8'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{result.label}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-ink/45">
                      {result.sublabel}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
