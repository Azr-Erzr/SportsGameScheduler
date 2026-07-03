#!/usr/bin/env node

const probes = []

const userAgent = 'SilboSportsBridgeProbe/0.1 (+https://silbosports.com)'

function htmlDecode(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
}

function stripTags(value = '') {
  return htmlDecode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

async function fetchText(name, url, options = {}) {
  const started = performance.now()
  const response = await fetch(url, {
    ...options,
    headers: {
      'user-agent': userAgent,
      ...(options.headers ?? {}),
    },
  })
  const elapsedMs = Math.round(performance.now() - started)
  const text = await response.text()
  if (!response.ok) throw new Error(`${name}: ${response.status} ${text.slice(0, 160)}`)
  return { text, response, elapsedMs }
}

async function fetchJson(name, url, options = {}) {
  const { text, response, elapsedMs } = await fetchText(name, url, options)
  try {
    return { json: JSON.parse(text), response, elapsedMs }
  } catch {
    throw new Error(`${name}: response was not JSON`)
  }
}

function nextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  return match ? JSON.parse(match[1]) : null
}

async function runProbe(id, runner) {
  try {
    const result = await runner()
    probes.push({ id, status: 'ok', ...result })
  } catch (error) {
    probes.push({
      id,
      status: 'failed',
      usefulness: 'blocked',
      ingestion: 'blocked',
      summary: error instanceof Error ? error.message : String(error),
    })
  }
}

await runProbe('world_athletics_calendar', async () => {
  const { text, elapsedMs } = await fetchText(
    'World Athletics calendar',
    'https://worldathletics.org/competition/calendar-results',
  )
  const data = nextData(text)
  const initialEvents = data?.props?.pageProps?.initialEvents
  const rows = Array.isArray(initialEvents?.results) ? initialEvents.results : []
  if (!rows.length) throw new Error('No structured calendar rows found in __NEXT_DATA__')
  const first = rows[0]
  return {
    usefulness: 'high',
    ingestion: 'moderate',
    records: rows.length,
    totalAdvertised: initialEvents.hits ?? null,
    elapsedMs,
    sample: `${first.name} | ${first.startDate}-${first.endDate} | ${first.venue} | ${first.disciplines}`,
    recommendation: 'Build dry-run athletics meet-window adapter first.',
  }
})

await runProbe('tfrrs_public_results', async () => {
  const { text, elapsedMs } = await fetchText('TFRRS results search', 'https://www.tfrrs.org/results_search.html')
  const rows = [...text.matchAll(/<tr>\s*<td>(.*?)<\/td>\s*<td><a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a><\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/g)]
  if (!rows.length) throw new Error('No result rows found')
  const first = rows[0]
  return {
    usefulness: 'medium',
    ingestion: 'moderate',
    records: rows.length,
    elapsedMs,
    sample: `${stripTags(first[3])} | ${stripTags(first[1])} | ${stripTags(first[4])} | ${stripTags(first[5])}`,
    recommendation: 'Useful for NCAA/US college track results; keep dry-run until terms/API posture is clarified.',
  }
})

await runProbe('opentrack_partner_or_api', async () => {
  const { text, elapsedMs } = await fetchText('OpenTrack docs', 'https://docs.opentrack.run/')
  const title = stripTags(text.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] ?? 'OpenTrack docs')
  const apiMentions = (text.match(/\bapi\b/gi) ?? []).length
  const resultMentions = (text.match(/\bresults?\b/gi) ?? []).length
  return {
    usefulness: 'medium-high-if-access-granted',
    ingestion: 'contact-required',
    records: 0,
    elapsedMs,
    sample: `${title}; api mentions=${apiMentions}; result mentions=${resultMentions}`,
    recommendation: 'Promising athletics data platform, but no public event feed surfaced. Contact for partner/API/export access.',
  }
})

await runProbe('cricsheet', async () => {
  const [{ text: downloads }, { text: peopleCsv }, { text: namesCsv }] = await Promise.all([
    fetchText('Cricsheet downloads', 'https://cricsheet.org/downloads/'),
    fetchText('Cricsheet people register', 'https://cricsheet.org/register/people.csv'),
    fetchText('Cricsheet names register', 'https://cricsheet.org/register/names.csv'),
  ])
  const zipLinks = [...downloads.matchAll(/href="([^"]+\.zip)"/g)].map((match) => match[1])
  const peopleRows = peopleCsv.trim().split(/\r?\n/)
  const namesRows = namesCsv.trim().split(/\r?\n/)
  return {
    usefulness: 'medium-high',
    ingestion: 'easy',
    records: zipLinks.length,
    elapsedMs: null,
    sample: `${zipLinks.slice(0, 3).join(', ')}; register rows=${peopleRows.length - 1}; alias rows=${namesRows.length - 1}`,
    recommendation: 'Use for cricket identity and historical match enrichment; not future fixtures.',
  }
})

await runProbe('openfootball', async () => {
  const { json, elapsedMs } = await fetchJson(
    'openfootball World Cup 2026',
    'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
  )
  const rows = Array.isArray(json.matches) ? json.matches : []
  if (!rows.length) throw new Error('No matches found')
  const first = rows[0]
  return {
    usefulness: 'medium',
    ingestion: 'easy',
    records: rows.length,
    elapsedMs,
    sample: `${first.round}: ${first.team1} vs ${first.team2} | ${first.date} ${first.time} | ${first.ground}`,
    recommendation: 'Good fallback/reference feed; do not replace provider schedule truth.',
  }
})

await runProbe('rugby_data_api', async () => {
  const { json, elapsedMs } = await fetchJson(
    'GitHub rugby-data-api metadata',
    'https://api.github.com/repos/punkstar/rugby-data-api',
    { headers: { accept: 'application/vnd.github+json' } },
  )
  return {
    usefulness: json.archived ? 'low' : 'medium',
    ingestion: json.archived ? 'do-not-prioritize' : 'moderate',
    records: json.archived ? 0 : null,
    elapsedMs,
    sample: `archived=${json.archived}; default_branch=${json.default_branch}; stars=${json.stargazers_count}; updated=${json.updated_at}`,
    recommendation: json.archived
      ? 'Do not prioritize; archived project with narrow older rugby coverage.'
      : 'Probe live endpoints and compare with RugbyFixture/TheSportsDB.',
  }
})

await runProbe('sportsdataverse', async () => {
  const { text, elapsedMs } = await fetchText('SportsDataverse packages', 'https://www.sportsdataverse.org/packages')
  const names = [...text.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const relevant = names.filter((name) =>
    /baseball|hoop|football|hockey|softball|nwsl|sportsdataverse|wehoop|cfb/i.test(name),
  )
  return {
    usefulness: 'medium',
    ingestion: 'moderate-hard',
    records: names.length,
    elapsedMs,
    sample: relevant.slice(0, 10).join(', '),
    recommendation: 'Use as package-level enrichment/cross-checks, not a direct all-sport schedule cron.',
  }
})

await runProbe('thesportsdb_secondary_art_and_schedule', async () => {
  const { json, elapsedMs } = await fetchJson(
    'TheSportsDB UFC next events',
    'https://www.thesportsdb.com/api/v1/json/123/eventsnextleague.php?id=4443',
  )
  const rows = Array.isArray(json.events) ? json.events : []
  const first = rows[0] ?? {}
  return {
    usefulness: 'high',
    ingestion: 'active',
    records: rows.length,
    elapsedMs,
    sample: `${first.strEvent ?? 'no event'} | ${first.strTimestamp ?? first.dateEvent ?? 'no date'} | badge=${Boolean(first.strLeagueBadge)}`,
    recommendation: 'Keep as baseline and compare bridge sources against it.',
  }
})

await runProbe('apisports_mma', async () => {
  const key = process.env.APISPORTS_KEY
  if (!key) {
    return {
      status: 'skipped',
      usefulness: 'unknown',
      ingestion: 'needs-existing-secret-probe',
      records: 0,
      elapsedMs: null,
      sample: 'APISPORTS_KEY is not present in local env.',
      recommendation: 'Probe through local APISPORTS_KEY or a server-side Supabase verifier using the existing deployed secret.',
    }
  }
  const base = process.env.APISPORTS_MMA_BASE_URL ?? 'https://v1.mma.api-sports.io'
  const { json, elapsedMs } = await fetchJson('API-Sports MMA fights', `${base}/fights?next=5`, {
    headers: { 'x-apisports-key': key },
  })
  const errors = json?.errors && Object.keys(json.errors).length ? JSON.stringify(json.errors) : ''
  if (errors) throw new Error(errors)
  const rows = Array.isArray(json.response) ? json.response : []
  return {
    usefulness: rows.length ? 'high-if-undercards-present' : 'unknown-empty',
    ingestion: 'moderate',
    records: rows.length,
    elapsedMs,
    sample: JSON.stringify(rows[0] ?? {}).slice(0, 240),
    recommendation: 'Inspect response shape for card/bout order before any fight-alert work.',
  }
})

for (const probe of probes) {
  const marker = probe.status === 'ok' ? 'OK' : probe.status === 'skipped' ? 'SKIP' : 'FAIL'
  console.log(`${marker} ${probe.id}`)
  console.log(`  usefulness: ${probe.usefulness}`)
  console.log(`  ingestion: ${probe.ingestion}`)
  console.log(`  records: ${probe.records ?? 'n/a'}`)
  if (probe.elapsedMs != null) console.log(`  elapsed: ${probe.elapsedMs}ms`)
  console.log(`  sample: ${probe.sample}`)
  console.log(`  next: ${probe.recommendation}`)
}

const failed = probes.filter((probe) => probe.status === 'failed')
if (failed.length) process.exit(1)
