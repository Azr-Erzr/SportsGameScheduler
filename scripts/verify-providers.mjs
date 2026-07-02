#!/usr/bin/env node

const checks = []

function env(name, fallback = '') {
  return process.env[name] || fallback
}

async function getJson(name, url, options = {}) {
  const started = performance.now()
  const response = await fetch(url, options)
  const elapsedMs = Math.round(performance.now() - started)
  const bodyText = await response.text()
  let json = null
  try {
    json = bodyText ? JSON.parse(bodyText) : null
  } catch {
    throw new Error(`${name}: response was not JSON (${response.status})`)
  }
  if (!response.ok) throw new Error(`${name}: ${response.status} ${bodyText.slice(0, 180)}`)
  return { json, elapsedMs }
}

async function check(name, requiredEnv, runner) {
  const missing = requiredEnv.filter((key) => !process.env[key])
  if (missing.length) {
    checks.push({ name, status: 'skipped', detail: `missing ${missing.join(', ')}` })
    return
  }
  try {
    const detail = await runner()
    checks.push({ name, status: 'ok', detail })
  } catch (error) {
    checks.push({ name, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
  }
}

await check('TheSportsDB premium/base adapter', [], async () => {
  const key = env('THESPORTSDB_API_KEY', '123')
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`
  const [{ json: league, elapsedMs: leagueMs }, { json: next, elapsedMs: nextMs }] = await Promise.all([
    getJson('TheSportsDB UFC league', `${base}/lookupleague.php?id=4443`),
    getJson('TheSportsDB MLB next events', `${base}/eventsnextleague.php?id=4424`),
  ])
  const leagueName = league?.leagues?.[0]?.strLeague
  const nextCount = Array.isArray(next?.events) ? next.events.length : 0
  if (!leagueName) throw new Error('lookupleague.php?id=4443 returned no league')
  return `${leagueName}; MLB next events=${nextCount}; ${leagueMs}/${nextMs}ms`
})

await check('API-SPORTS football adapter', ['APISPORTS_KEY'], async () => {
  const base = env('APISPORTS_FOOTBALL_BASE_URL', 'https://v3.football.api-sports.io')
  const season = env('APISPORTS_VERIFY_SEASON', '2026')
  const { json, elapsedMs } = await getJson(
    'API-SPORTS football',
    `${base}/fixtures?league=1&season=${season}&next=3`,
    { headers: { 'x-apisports-key': env('APISPORTS_KEY') } },
  )
  const count = Array.isArray(json?.response) ? json.response.length : 0
  const errors = json?.errors && Object.keys(json.errors).length ? JSON.stringify(json.errors) : ''
  if (errors) throw new Error(errors)
  return `fixtures=${count}; season=${season}; ${elapsedMs}ms`
})

await check('API-SPORTS Formula 1 adapter', ['APISPORTS_KEY'], async () => {
  const base = env('APISPORTS_FORMULA1_BASE_URL', 'https://v1.formula-1.api-sports.io')
  const season = env('APISPORTS_F1_VERIFY_SEASON', '2024')
  const { json, elapsedMs } = await getJson(
    'API-SPORTS Formula 1',
    `${base}/races?season=${season}`,
    { headers: { 'x-apisports-key': env('APISPORTS_KEY') } },
  )
  const count = Array.isArray(json?.response) ? json.response.length : 0
  const errors = json?.errors && Object.keys(json.errors).length ? JSON.stringify(json.errors) : ''
  if (errors) throw new Error(errors)
  return `races=${count}; season=${season}; ${elapsedMs}ms`
})

await check('OpenF1 public adapter', [], async () => {
  const base = env('OPENF1_BASE_URL', 'https://api.openf1.org/v1')
  const year = env('OPENF1_VERIFY_YEAR', String(new Date().getUTCFullYear()))
  const [{ json: meetings, elapsedMs: meetingsMs }, { json: sessions, elapsedMs: sessionsMs }] = await Promise.all([
    getJson('OpenF1 meetings', `${base}/meetings?year=${year}`),
    getJson('OpenF1 sessions', `${base}/sessions?year=${year}`),
  ])
  const meetingCount = Array.isArray(meetings) ? meetings.length : 0
  const sessionCount = Array.isArray(sessions) ? sessions.length : 0
  if (!meetingCount) throw new Error(`meetings?year=${year} returned no rows`)
  if (!sessionCount) throw new Error(`sessions?year=${year} returned no rows`)
  return `meetings=${meetingCount}; sessions=${sessionCount}; year=${year}; ${meetingsMs}/${sessionsMs}ms`
})

await check('Combat data path', [], async () => {
  const key = env('THESPORTSDB_API_KEY', '123')
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`
  const [{ json: ufc }, { json: pfl }] = await Promise.all([
    getJson('TheSportsDB UFC next events', `${base}/eventsnextleague.php?id=4443`),
    getJson('TheSportsDB PFL next events', `${base}/eventsnextleague.php?id=5358`),
  ])
  const ufcCount = Array.isArray(ufc?.events) ? ufc.events.length : 0
  const pflCount = Array.isArray(pfl?.events) ? pfl.events.length : 0
  return `UFC next=${ufcCount}; PFL next=${pflCount}`
})

const failed = checks.filter((entry) => entry.status === 'failed')
for (const entry of checks) {
  const marker = entry.status === 'ok' ? 'OK' : entry.status === 'skipped' ? 'SKIP' : 'FAIL'
  console.log(`${marker} ${entry.name} - ${entry.detail}`)
}

if (failed.length) process.exit(1)
