import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fail the PRODUCTION build if the public Supabase env is missing. Without this guard, a build run
// in an environment without these vars inlines an empty key, ships a null Supabase client, and
// silently empties every live-data page (schedules, alerts, sign-in) while static content — e.g.
// the soccer World Cup planner — still renders. That regression already shipped once; this turns
// it into a loud build failure instead. Dev (serve) is exempt so local-only mode still runs.
function requireSupabaseEnv(): Plugin {
  return {
    name: 'require-supabase-env',
    apply: 'build',
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd())
      const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter((key) => !env[key])
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
export default defineConfig({
  plugins: [requireSupabaseEnv(), react(), tailwindcss()],
  // Respect the harness/preview-assigned port when present (vite ignores PORT by default).
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
})
