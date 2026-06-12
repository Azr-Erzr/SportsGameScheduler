import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { User } from '@supabase/supabase-js'
import { AppStateContext } from './state-context'
import {
  getFollows,
  getPreferences,
  savePreferences,
  toggleFollow as storeToggleFollow,
  type Follow,
  type Preferences,
} from '../lib/store'
import { supabase } from '../lib/supabase'

// App-wide state: follows + display preferences, persisted through src/lib/store.ts.
// When Supabase auth lands, this context keeps the same shape and the store swaps backends.

export function AppStateProvider({ children }: PropsWithChildren) {
  const [follows, setFollows] = useState<Follow[]>(() => getFollows())
  const [prefs, setPrefsState] = useState<Preferences>(() => getPreferences())
  const [authReady, setAuthReady] = useState(!supabase)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const toggleFollow = useCallback((follow: Follow) => {
    setFollows(storeToggleFollow(follow))
  }, [])

  const setPrefs = useCallback((next: Preferences) => {
    savePreferences(next)
    setPrefsState(next)
  }, [])

  const followedTeams = useMemo(
    () => follows.filter((f) => f.targetType === 'team').map((f) => f.targetId),
    [follows],
  )

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      follows,
      toggleFollow,
      followedTeams,
      prefs,
      setPrefs,
      auth: {
        ready: authReady,
        user,
        configured: Boolean(supabase),
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
      },
    }),
    [authReady, follows, followedTeams, prefs, setPrefs, signInWithGoogle, signInWithMagicLink, signOut, toggleFollow, user],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
