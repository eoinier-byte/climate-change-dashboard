/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.jsx'],
    // Vitest runs the unit tests only. The e2e/ folder holds the Playwright tests (CCD-233),
    // which run in a real browser with "npm run test:e2e", so Vitest must skip them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})