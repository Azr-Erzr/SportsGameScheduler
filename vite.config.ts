import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Tailwind v4 is wired here but only takes effect for files that import `src/styles/tailwind.css`.
// The dark App.css UI still renders unchanged until the visual migration switches that import on.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Respect the harness/preview-assigned port when present (vite ignores PORT by default).
  server: { port: Number(process.env.PORT) || 5173 },
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
})
