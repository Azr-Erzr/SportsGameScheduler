#!/usr/bin/env node

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const MAIN_SPORTS = [
  { route: 'soccer', canonical: 'soccer', label: 'Soccer' },
  { route: 'basketball', canonical: 'basketball', label: 'Basketball' },
  { route: 'football', canonical: 'american_football', label: 'American Football' },
  { route: 'hockey', canonical: 'hockey', label: 'Hockey' },
  { route: 'tennis', canonical: 'tennis', label: 'Tennis' },
  { route: 'golf', canonical: 'golf', label: 'Golf' },
  { route: 'motorsport', canonical: 'motorsport', label: 'Motorsport' },
  { route: 'combat', canonical: 'combat_sports', label: 'Combat Sports' },
  { route: 'track', canonical: 'athletics', label: 'Track & Field' },
  { route: 'olympic', canonical: 'olympic_sports', label: 'Olympic Sports' },
  { route: 'baseball', canonical: 'baseball', label: 'Baseball' },
]

function loadEnv(path) {
  if (!fs.existsSync(path)) return
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 0) continue
    const key = trimmed.slice(0, separator)
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] ||= value
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

loadEnv('.env')

const supabaseUrl = requireEnv('VITE_SUPABASE_URL')
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!supabaseKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY')

const supabase = createClient(supabaseUrl, supabaseKey)
const since = new Date(Date.now() - 3 * 3600_000).toISOString()

async function countRows(label, query) {
  const { count, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return count ?? 0
}

const rows = []
for (const sport of MAIN_SPORTS) {
  const [leagues, events, upcoming, players] = await Promise.all([
    countRows(
      `${sport.canonical} leagues`,
      supabase
        .from('leagues')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', sport.canonical)
        .eq('is_public', true),
    ),
    countRows(
      `${sport.canonical} events`,
      supabase
        .from('events')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', sport.canonical)
        .eq('visibility', 'public'),
    ),
    countRows(
      `${sport.canonical} upcoming`,
      supabase
        .from('events')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', sport.canonical)
        .eq('visibility', 'public')
        .neq('status', 'finished')
        .gte('starts_at', since),
    ),
    countRows(
      `${sport.canonical} players`,
      supabase
        .from('competitors')
        .select('id, sports!inner(key)', { count: 'exact', head: true })
        .eq('sports.key', sport.canonical)
        .eq('kind', 'person'),
    ),
  ])
  rows.push({ ...sport, leagues, events, upcoming, players })
}

const missing = rows.filter((row) => row.leagues < 1 || row.events < 1)
console.table(
  rows.map(({ route, canonical, label, leagues, events, upcoming, players }) => ({
    route: `/sports/${route}`,
    canonical,
    label,
    leagues,
    events,
    upcoming,
    players,
  })),
)

if (missing.length) {
  console.error(`Main sport coverage missing for: ${missing.map((row) => row.label).join(', ')}`)
  process.exit(1)
}

const noUpcoming = rows.filter((row) => row.upcoming < 1)
if (noUpcoming.length) {
  console.warn(`No upcoming rows right now: ${noUpcoming.map((row) => row.label).join(', ')}. This is display-safe only if the page has a standby/roster state.`)
}
