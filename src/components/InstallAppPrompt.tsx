import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'silbo-install-prompt-dismissed'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
}

export function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (hidden || isStandalone()) return

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [hidden])

  if (hidden || !promptEvent || isStandalone()) return null

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') dismiss()
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setHidden(true)
    setPromptEvent(null)
  }

  return (
    <aside className="silbo-floating-panel fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 mx-auto max-w-md rounded-card border border-primary/25 bg-surface/95 p-3 shadow-[0_-8px_28px_rgba(0,0,0,0.28)] md:bottom-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-primary">Save Silbo to your phone</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink/62">Open schedules faster from your home screen.</p>
          <div className="mt-2 flex gap-2">
            <Button className="px-3 py-1.5 text-xs" onClick={install}>
              Install
            </Button>
            <Button className="px-3 py-1.5 text-xs" variant="ghost" onClick={dismiss}>
              Later
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/45 hover:bg-primary/10 hover:text-primary"
          aria-label="Dismiss install prompt"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  )
}
