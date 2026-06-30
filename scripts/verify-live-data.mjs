import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const strict = process.argv.includes('--strict')

function loadEnvFile(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (process.env[key]) continue
    process.env[key] = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
  }
}

for (const name of ['.env.production.local', '.env.production', '.env.local', '.env']) {
  loadEnvFile(path.join(root, name))
}

function loadWranglerVars() {
  const file = path.join(root, 'wrangler.jsonc')
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
    if (process.env[key]) continue
    const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))
    if (match?.[1]) process.env[key] = match[1]
  }
}

loadWranglerVars()

if (process.env.SILBO_SKIP_LIVE_DATA_VERIFY === '1') {
  console.log('skip live data verification (SILBO_SKIP_LIVE_DATA_VERIFY=1)')
  process.exit(0)
}

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('fail live data verification: missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const nowIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

const criticalSports = [
  { key: 'soccer', minUpcoming: 100, minLeagues: 5 },
  { key: 'baseball', minUpcoming: 100, minLeagues: 1 },
  { key: 'basketball', minUpcoming: 10, minLeagues: 1 },
  { key: 'american_football', minUpcoming: 10, minLeagues: 1 },
  { key: 'motorsport', minUpcoming: 10, minLeagues: 1 },
  { key: 'combat_sports', minUpcoming: 10, minLeagues: 1 },
  { key: 'golf', minUpcoming: 10, minLeagues: 1 },
  { key: 'rugby', minUpcoming: 10, minLeagues: 1 },
  { key: 'esports', minUpcoming: 10, minLeagues: 1 },
  { key: 'hockey', minUpcoming: 1, minLeagues: 1 },
  { key: 'snooker', minUpcoming: 1, minLeagues: 1 },
  { key: 'darts', minUpcoming: 1, minLeagues: 1 },
  { key: 'olympic_sports', minUpcoming: 1, minLeagues: 1 },
]

const optionalSports = ['tennis', 'athletics', 'cycling', 'cricket', 'volleyball', 'handball']

async function countRows(label, query) {
  const { count, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return count ?? 0
}

async function verifySport({ key, minUpcoming, minLeagues }) {
  const [leagueCount, eventCount, sample] = await Promise.all([
    countRows(
      `${key} public leagues`,
      supabase
        .from('leagues')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', key)
        .eq('is_public', true),
    ),
    countRows(
      `${key} upcoming events`,
      supabase
        .from('events')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', key)
        .eq('visibility', 'public')
        .neq('status', 'finished')
        .gte('starts_at', nowIso),
    ),
    supabase
      .from('events')
      .select('id, title, starts_at, starts_at_tbd, status, kind, metadata, league_id, venues(name), sports!inner(key)')
      .eq('sports.key', key)
      .eq('visibility', 'public')
      .neq('status', 'finished')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(1),
  ])

  if (sample.error) throw new Error(`${key} frontend event shape: ${sample.error.message}`)

  const failures = []
  if (leagueCount < minLeagues) failures.push(`leagues ${leagueCount} < ${minLeagues}`)
  if (eventCount < minUpcoming) failures.push(`upcoming ${eventCount} < ${minUpcoming}`)
  if (eventCount > 0 && !sample.data?.length) failures.push('count is nonzero but sample read returned no rows')

  return { key, leagueCount, eventCount, ok: failures.length === 0, failures }
}

async function verifyOptionalSport(key) {
  const [leagueCount, eventCount] = await Promise.all([
    countRows(
      `${key} optional public leagues`,
      supabase
        .from('leagues')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', key)
        .eq('is_public', true),
    ),
    countRows(
      `${key} optional upcoming events`,
      supabase
        .from('events')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', key)
        .eq('visibility', 'public')
        .neq('status', 'finished')
        .gte('starts_at', nowIso),
    ),
  ])
  return { key, leagueCount, eventCount }
}

const criticalResults = []
for (const sport of criticalSports) {
  criticalResults.push(await verifySport(sport))
}

const optionalResults = []
for (const sport of optionalSports) {
  optionalResults.push(await verifyOptionalSport(sport))
}

for (const row of criticalResults) {
  const icon = row.ok ? 'ok' : 'fail'
  console.log(`${icon.padEnd(4)} ${row.key.padEnd(18)} ${String(row.eventCount).padStart(6)} upcoming, ${row.leagueCount} leagues`)
  for (const failure of row.failures) console.log(`     ${failure}`)
}

for (const row of optionalResults) {
  const icon = row.eventCount > 0 ? 'ok' : 'warn'
  console.log(`${icon.padEnd(4)} ${row.key.padEnd(18)} ${String(row.eventCount).padStart(6)} upcoming, ${row.leagueCount} leagues (optional/seasonal)`)
}

const failures = criticalResults.filter((row) => !row.ok)
if (failures.length) {
  console.error(`\n${failures.length} critical live data check${failures.length === 1 ? '' : 's'} failed.`)
  process.exit(strict ? 1 : 0)
}

console.log('\nlive data verification passed')
