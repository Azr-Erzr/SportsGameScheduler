import type { SupabaseClient } from '@supabase/supabase-js'

// Publishable key only; safe to ship to browsers. RLS enforces what the client can read.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

let clientPromise: Promise<SupabaseClient | null> | null = null

export const isSupabaseConfigured = Boolean(url && key)

export function getSupabaseClient() {
  if (!isSupabaseConfigured) return Promise.resolve(null)
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url as string, key as string),
  )
  return clientPromise
}
