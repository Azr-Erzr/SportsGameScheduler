import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execSync } from 'node:child_process'

const root = process.cwd()
const strict = process.argv.includes('--strict')

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function loadEnvFile(file) {
  const text = readText(file)
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
  const text = readText(path.join(root, 'wrangler.jsonc'))
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) {
    if (process.env[key]) continue
    const match = text.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))
    if (match?.[1]) process.env[key] = match[1]
  }
}

const checks = []
const deployedSecretNames = new Set()

function check(name, ok, detail, severity = 'error') {
  checks.push({ name, ok: Boolean(ok), detail, severity })
}

function hasAny(...keys) {
  return keys.some((key) => Boolean(process.env[key]) || deployedSecretNames.has(key))
}

function envValue(key) {
  return process.env[key] ?? ''
}

function discoverSupabaseProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF
  const localRef = readText(path.join(root, 'supabase/.temp/project-ref')).trim()
  if (localRef) return localRef
  const match = readText(path.join(root, 'wrangler.jsonc')).match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match?.[1] ?? ''
}

function loadDeployedSecretNames() {
  const projectRef = discoverSupabaseProjectRef()
  if (!projectRef) return
  if (!/^[a-z0-9]+$/i.test(projectRef)) return

  try {
    const output = execSync(`npx supabase secrets list --project-ref ${projectRef}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 60_000,
    })
    const parsed = JSON.parse(output)
    for (const item of parsed.secrets ?? []) {
      if (item?.name) deployedSecretNames.add(String(item.name))
    }
  } catch (_) {
    // Offline/unauthenticated audits still work from local env files; the check output below will
    // show which secrets could not be proven present.
  }
}

const seoText = readText(path.join(root, 'src/lib/seo.ts'))
const wranglerText = readText(path.join(root, 'wrangler.jsonc'))
const deploymentDoc = readText(path.join(root, 'docs/deployment.md'))

loadWranglerVars()
loadDeployedSecretNames()

check('Cloudflare/Vite Supabase URL', hasAny('VITE_SUPABASE_URL'), 'Set VITE_SUPABASE_URL in Pages build env.')
check(
  'Cloudflare/Vite Supabase publishable key',
  hasAny('VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'),
  'Set VITE_SUPABASE_PUBLISHABLE_KEY in Pages build env.',
)
check(
  'Frontend VAPID public key',
  hasAny('VITE_VAPID_PUBLIC_KEY'),
  'Set VITE_VAPID_PUBLIC_KEY in Pages build env so browser push can subscribe.',
  'warn',
)
check('Provider secret: TheSportsDB', hasAny('THESPORTSDB_API_KEY'), 'Set THESPORTSDB_API_KEY as a Supabase function secret.')
check(
  'Email provider secret: Resend',
  hasAny('RESEND_API_KEY', 'RESENDAPI'),
  'Set RESEND_API_KEY as a Supabase function secret; RESENDAPI is accepted for compatibility.',
)
check('Alert email from address', hasAny('EMAIL_FROM'), 'Set EMAIL_FROM to a verified sender, e.g. Silbo Sports <alerts@silbosports.com>.')
check('Edge app URL', hasAny('APP_URL'), 'Set APP_URL=https://silbosports.com for Edge Functions and email links.')
check(
  'Push VAPID function secrets',
  hasAny('VAPID_PUBLIC_KEY') && hasAny('VAPID_PRIVATE_KEY') && hasAny('VAPID_SUBJECT'),
  'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT as Supabase function secrets.',
  'warn',
)
check('Admin allowlist', hasAny('ADMIN_EMAILS'), 'Set ADMIN_EMAILS to a comma-separated admin allowlist.', 'warn')
check(
  'Canonical domain locked',
  seoText.includes("SEO_ORIGIN = 'https://silbosports.com'") && wranglerText.includes('"name": "silbosports"'),
  'src/lib/seo.ts should canonicalize to https://silbosports.com and Wrangler should deploy silbosports.',
)
check(
  'APP_URL uses production domain',
  !envValue('APP_URL') || envValue('APP_URL').replace(/\/$/, '') === 'https://silbosports.com',
  `Current APP_URL=${envValue('APP_URL') || '(unset)'}. Production should be https://silbosports.com.`,
  'warn',
)
check('OG cover asset', existsSync(path.join(root, 'public/og-cover.png')), 'public/og-cover.png exists for social cards.')
check(
  'Immutable asset headers',
  existsSync(path.join(root, 'public/_headers')),
  'public/_headers should ship immutable cache headers for fingerprinted assets.',
  'warn',
)
check(
  'SPA fallback configured',
  wranglerText.includes('"not_found_handling": "single-page-application"') ||
    existsSync(path.join(root, 'public/_redirects')),
  'Use Wrangler static assets single-page fallback or public/_redirects.',
)
check(
  'Rate limiting documented',
  deploymentDoc.includes('Cloudflare WAF') && existsSync(path.join(root, 'docs/admin-and-rate-limiting.md')),
  'Cloudflare WAF/rate-limit setup should be documented before launch.',
)

const failures = checks.filter((item) => !item.ok && item.severity === 'error')
const warnings = checks.filter((item) => !item.ok && item.severity === 'warn')

for (const item of checks) {
  const icon = item.ok ? 'ok' : item.severity === 'warn' ? 'warn' : 'fail'
  console.log(`${icon.padEnd(4)} ${item.name}`)
  if (!item.ok) console.log(`     ${item.detail}`)
}

console.log('')
console.log(`${checks.length - failures.length - warnings.length}/${checks.length} checks clean`)
if (warnings.length) console.log(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
if (failures.length) console.log(`${failures.length} failure${failures.length === 1 ? '' : 's'}`)

if (strict && failures.length) process.exit(1)
