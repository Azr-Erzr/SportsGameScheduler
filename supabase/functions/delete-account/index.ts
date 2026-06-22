// POST /delete-account — permanently delete the authenticated user and all their data (GDPR,
// account plan Phase 5). The caller proves identity with their own access token; we then use the
// service role to remove the auth user. Every user-owned table (profiles, user_follows,
// calendar_feeds, alert_preferences, push subscriptions, custom_leagues) is FK'd to auth.users
// with ON DELETE CASCADE, so deleting the auth user cleans up everything in one step.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Missing authorization' }, 401)

  // Resolve the caller from their own token (anon client, no elevated rights).
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData?.user) return json({ error: 'Invalid or expired session' }, 401)

  const userId = userData.user.id

  // Service role performs the irreversible deletion. Cascades handle owned rows.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ ok: true })
})
