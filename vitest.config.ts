// Vitest configuration.
//
// Role in the architecture: Vitest is our unit + component test runner. It runs
// plain TypeScript/React tests in Node (with a simulated browser DOM), without
// needing the Next.js server or a real browser. End-to-end browser tests are a
// separate concern handled by Playwright (see playwright.config.ts).

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // The React plugin lets Vitest understand JSX/TSX in component tests.
  plugins: [react()],
  test: {
    // `globals: true` exposes describe/it/expect without importing them in
    // every file (same ergonomics as Jest).
    globals: true,
    // jsdom simulates a browser DOM in Node so we can render React components
    // and query the resulting HTML in component tests.
    environment: 'jsdom',
    // Runs once before the test suite to wire up custom matchers / cleanup.
    setupFiles: ['./vitest.setup.ts'],
    // Vitest owns *.test.ts(x). Playwright owns the e2e/ folder (*.spec.ts),
    // which we exclude here so the two runners never pick up each other's tests.
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
  resolve: {
    // Mirror the "@/*" -> "./*" path alias from tsconfig.json so imports like
    // `@/lib/format` resolve the same way inside tests as they do in the app.
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
