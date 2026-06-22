import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // supabase/functions are Deno-runtime and worker/ is the Cloudflare Workers runtime
  // (HTMLRewriter, ExecutionContext, ASSETS binding) — both use non-browser globals and are
  // type-checked/bundled by their own toolchains, so they're excluded from the app lint pass.
  globalIgnores(['dist', 'supabase/functions', 'worker']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
