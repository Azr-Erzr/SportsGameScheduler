import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

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

const checks = []

function check(name, ok, detail, severity = 'error') {
  checks.push({ name, ok: Boolean(ok), detail, severity })
}

function hasAny(...keys) {
  return keys.some((key) => Boolean(process.env[key]))
}

function envValue(key) {
  return process.env[key] ?? ''
}

const seoText = readText(path.join(root, 'src/lib/seo.ts'))
const wranglerText = readText(path.join(root, 'wrangler.jsonc'))
const deploymentDoc = readText(path.join(root, 'docs/deployment.md'))

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
