import { LogIn, LogOut, Mail, UserCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAppState } from '../app/state-context'
import { Button } from './ui'

export function AuthButton() {
  const { auth, follows } = useAppState()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submitMagicLink(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setMessage('')
    try {
      await auth.signInWithMagicLink(email.trim())
      setMessage('Magic link sent. Open it on this device to back up your schedule.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send magic link.')
    } finally {
      setBusy(false)
    }
  }

  async function signInGoogle() {
    setBusy(true)
    setMessage('')
    try {
      await auth.signInWithGoogle()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start Google sign-in.')
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await auth.signOut()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (!auth.configured) {
    return (
      <Button
        variant="ghost"
        disabled
        title="Supabase is not configured for this environment"
        aria-label="Local-only mode"
        className="max-sm:h-10 max-sm:w-10 max-sm:px-0"
      >
        <UserCircle size={16} />
        <span className="hidden sm:inline">Local</span>
      </Button>
    )
  }

  if (auth.user) {
    return (
      <Button
        variant="subtle"
        onClick={signOut}
        disabled={busy}
        title={auth.user.email ?? 'Signed in'}
        className="max-sm:h-10 max-sm:w-10 max-sm:px-0"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen((current) => !current)} className="max-sm:h-10 max-sm:w-10 max-sm:px-0">
        <LogIn size={16} />
        <span className="hidden sm:inline">Sign in</span>
      </Button>

      {open && (
          <div className="auth-popover fixed inset-x-3 top-[4.6rem] z-50 rounded-card border border-primary/15 bg-surface p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)] sm:w-96">
            <h2 className="text-base font-bold text-primary">Back up your schedule</h2>
            <p className="mt-1 text-sm text-ink/60">
              Sign in when you want cross-device follows, live feed management, alerts, or custom-league publishing.
              {follows.length === 1
                ? ' Your local follow will merge into your account automatically.'
                : ` Your ${follows.length} local follows will merge into your account automatically.`}
            </p>

            <form onSubmit={submitMagicLink} className="mt-4 space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-primary/20 bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <Button className="w-full" type="submit" disabled={busy}>
                <Mail size={15} /> Send magic link
              </Button>
            </form>

            <Button className="mt-2 w-full" variant="ghost" onClick={signInGoogle} disabled={busy}>
              <LogIn size={15} /> Continue with Google
            </Button>

            {message && <p className="mt-3 text-sm font-medium text-primary">{message}</p>}
          </div>
        )}
    </div>
  )
}
