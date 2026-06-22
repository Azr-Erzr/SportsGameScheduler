import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync } from 'node:fs'

type PublicSupabaseEnv = {
  url?: string
  publishableKey?: string
}

function readWranglerPublicSupabaseEnv(): PublicSupabaseEnv {
  const configPath = 'wrangler.jsonc'
  if (!existsSync(configPath)) return {}

  const source = readFileSync(configPath, 'utf8')
  const valueFor = (key: string) => {
    const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))
    return match?.[1]
  }

  return {
    url: valueFor('VITE_SUPABASE_URL') ?? valueFor('SUPABASE_URL'),
    publishableKey:
      valueFor('VITE_SUPABASE_PUBLISHABLE_KEY') ??
      valueFor('VITE_SUPABASE_ANON_KEY') ??
      valueFor('SUPABASE_PUBLISHABLE_KEY'),
  }
}

function resolvePublicSupabaseEnv(mode: string): PublicSupabaseEnv {
  const env = loadEnv(mode, process.cwd(), '')
  const wranglerEnv = readWranglerPublicSupabaseEnv()

  return {
    url: env.VITE_SUPABASE_URL ?? env.SUPABASE_URL ?? wranglerEnv.url,
    publishableKey:
      env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      env.VITE_SUPABASE_ANON_KEY ??
      env.SUPABASE_PUBLISHABLE_KEY ??
      wranglerEnv.publishableKey,
  }
}

// Fail the PRODUCTION build if the public Supabase env is missing. Without this guard, a build run
// in an environment without these vars inlines an empty key, ships a null Supabase client, and
// silently empties every live-data page (schedules, alerts, sign-in) while static content — e.g.
// the soccer World Cup planner — still renders. That regression already shipped once; this turns
// it into a loud build failure instead. Dev (serve) is exempt so local-only mode still runs.
function requireSupabaseEnv(supabaseEnv: PublicSupabaseEnv): Plugin {
  return {
    name: 'require-supabase-env',
    apply: 'build',
    config() {
      const missing = [
        ['VITE_SUPABASE_URL', supabaseEnv.url],
        ['VITE_SUPABASE_PUBLISHABLE_KEY', supabaseEnv.publishableKey],
      ].flatMap(([key, value]) => (value ? [] : [key]))
      if (missing.length) {
        throw new Error(
          `Build aborted: missing ${missing.join(', ')}. The deployed bundle would have a dead ` +
            `Supabase client and every live schedule would be empty. Set them in .env or the build environment.`,
        )
      }
    },
  }
}

// https://vite.dev/config/
// Tailwind v4 is wired here but only takes effect for files that import `src/styles/tailwind.css`.
// The dark App.css UI still renders unchanged until the visual migration switches that import on.
export default defineConfig(({ mode }) => {
  const supabaseEnv = resolvePublicSupabaseEnv(mode)

  return {
    plugins: [requireSupabaseEnv(supabaseEnv), react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseEnv.url ?? ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseEnv.publishableKey ?? ''),
    },
    // Respect the harness/preview-assigned port when present (vite ignores PORT by default).
    server: { port: Number(process.env.PORT) || 5173 },
    test: {
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    },
  }
})
