import { createClient } from '@supabase/supabase-js'

// Publishable key only — safe to ship to browsers; RLS enforces what it can read.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null
