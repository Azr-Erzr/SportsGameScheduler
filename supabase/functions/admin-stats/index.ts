// Admin observability snapshot. Returns the aggregated admin_overview() only to allowlisted
// admins. The caller's JWT is resolved to a user; their email must be in ADMIN_EMAILS
// (comma-separated). Service role runs the aggregate query; RLS is intentionally bypassed AFTER
// the admin check.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'unauthorized' }, 401)

  const { data: userData } = await supabase.auth.getUser(token)
  const email = userData?.user?.email?.toLowerCase()
  if (!email) return json({ error: 'unauthorized' }, 401)
  if (ADMIN_EMAILS.length === 0 || !ADMIN_EMAILS.includes(email)) {
    return json({ error: 'forbidden', hint: 'Add this email to the ADMIN_EMAILS secret.' }, 403)
  }

  const { data, error } = await supabase.rpc('admin_overview')
  if (error) return json({ error: error.message }, 500)
  return json(data)
})
