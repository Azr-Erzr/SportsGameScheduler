import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { User } from '@supabase/supabase-js'
import { AppStateContext } from './state-context'
import {
  getFollows,
  getPreferences,
  saveFollows,
  savePreferences,
  toggleFollow as storeToggleFollow,
  type Follow,
  type Preferences,
} from '../lib/store'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import {
  isDbFollow,
  mergeFollowsOnSignIn,
  loadRemotePrefs,
  pushFollow,
  removeFollow,
  saveRemotePrefs,
} from '../data/userData'

// App-wide state: follows + display preferences, persisted through src/lib/store.ts (localStorage)
// and mirrored to Supabase (user_follows + profiles) once the user signs in. DB-eligible follows
// (sport/league/competitor/custom_league with uuid ids) sync; World Cup "team" follows stay local.

export function AppStateProvider({ children }: PropsWithChildren) {
  const [follows, setFollows] = useState<Follow[]>(() => getFollows())
  const [prefs, setPrefsState] = useState<Preferences>(() => getPreferences())
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true
    let cleanup: (() => void) | undefined

    getSupabaseClient().then((supabase) => {
      if (!mounted || !supabase) return

      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return
        setUser(data.session?.user ?? null)
        setAuthReady(true)
      })

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
        setAuthReady(true)
      })
      cleanup = () => listener.subscription.unsubscribe()
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [])

  // On sign-in: merge local follows into the account and adopt server preferences.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getSupabaseClient().then(async (supabase) => {
      if (!supabase || cancelled) return
      const merged = await mergeFollowsOnSignIn(supabase, user.id, getFollows())
      if (cancelled) return
      saveFollows(merged)
      setFollows(merged)

      const remotePrefs = await loadRemotePrefs(supabase, user.id)
      if (cancelled) return
      if (remotePrefs && Object.keys(remotePrefs).length) {
        setPrefsState((current) => {
          const next = { ...current, ...remotePrefs }
          savePreferences(next)
          return next
        })
      } else {
        // First sign-in with no server profile yet: seed it from local prefs.
        await saveRemotePrefs(supabase, user.id, getPreferences())
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const toggleFollow = useCallback(
    (follow: Follow) => {
      const next = storeToggleFollow(follow)
      setFollows(next)
      const nowFollowing = next.some(
        (f) => f.targetType === follow.targetType && f.targetId === follow.targetId && f.intent === follow.intent,
      )
      if (user && isDbFollow(follow)) {
        getSupabaseClient().then((supabase) => {
          if (!supabase) return
          if (nowFollowing) void pushFollow(supabase, user.id, follow)
          else void removeFollow(supabase, user.id, follow)
        })
      }
    },
    [user],
  )

  const setPrefs = useCallback(
    (next: Preferences) => {
      savePreferences(next)
      setPrefsState(next)
      if (user) {
        getSupabaseClient().then((supabase) => {
          if (supabase) void saveRemotePrefs(supabase, user.id, next)
        })
      }
    },
    [user],
  )

  const followedTeams = useMemo(
    () => follows.filter((f) => f.targetType === 'team').map((f) => f.targetId),
    [follows],
  )
  const followedLeagueIds = useMemo(
    () => follows.filter((f) => f.targetType === 'league').map((f) => f.targetId),
    [follows],
  )
  const followedCompetitorIds = useMemo(
    () => follows.filter((f) => f.targetType === 'competitor').map((f) => f.targetId),
    [follows],
  )

  const signInWithMagicLink = useCallback(async (email: string) => {
    const supabase = await getSupabaseClient()
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const supabase = await getSupabaseClient()
    if (!supabase) throw new Error('Supabase is not configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseClient()
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      follows,
      toggleFollow,
      followedTeams,
      followedLeagueIds,
      followedCompetitorIds,
      prefs,
      setPrefs,
      auth: {
        ready: authReady,
        user,
        configured: isSupabaseConfigured,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
      },
    }),
    [
      authReady,
      follows,
      followedTeams,
      followedLeagueIds,
      followedCompetitorIds,
      prefs,
      setPrefs,
      signInWithGoogle,
      signInWithMagicLink,
      signOut,
      toggleFollow,
      user,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
