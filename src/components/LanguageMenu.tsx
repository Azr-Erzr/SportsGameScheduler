import { useEffect, useRef, useState } from 'react'
import { Check, Languages } from 'lucide-react'
import { useAppState } from '../app/state-context'
import { localeOptions, normalizeLocale } from '../lib/i18n'

// Compact header language switcher. The locale also lives in onboarding, Account, and the Exports
// city picker, but most people never reach those — so it gets a permanent button next to the theme
// toggle. Writes prefs.locale (synced to the account when signed in).

export function LanguageMenu() {
  const { prefs, setPrefs } = useAppState()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = normalizeLocale(prefs.locale)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = localeOptions.find((l) => l.code === active)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change language"
        title="Change language"
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-primary/30 px-2 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:h-10 sm:gap-1.5 sm:px-2.5"
      >
        <Languages size={16} />
        <span className="font-mono text-[10px] font-bold uppercase sm:text-[11px]">{current?.shortLabel ?? 'EN'}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-xl border border-primary/20 bg-surface p-1.5 shadow-xl"
        >
          {localeOptions.map((locale) => {
            const selected = locale.code === active
            return (
              <button
                key={locale.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setPrefs({ ...prefs, locale: locale.code })
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selected ? 'bg-primary/12 font-semibold text-primary' : 'text-ink/80 hover:bg-primary/8'
                }`}
              >
                <span className="font-mono text-[10px] uppercase text-ink/45">{locale.shortLabel}</span>
                <span className="flex-1">{locale.label}</span>
                {selected && <Check size={15} className="text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
