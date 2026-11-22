// Playwright settings for the end-to-end tests (CCD-233).
// The tests open the real site in Chrome and click through it like a user would.
// They live in frontend/e2e/ and run with: npm run test:e2e
import { defineConfig, devices } from '@playwright/test';

// The port the test copy of the site runs on. It is not 5173, so the tests never
// use your own "npm run dev" window (which may be talking to the real backend).
const PORT = 5174;

export default defineConfig({
  // Where the test files are
  testDir: './e2e',

  // On GitHub (CI) retry a failed test once, in case it was a slow start; locally don't retry
  retries: process.env.CI ? 1 : 0,

  // Make a report folder (playwright-report) we can open if a test fails
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    // So tests can say page.goto('/') instead of the full address
    baseURL: `http://localhost:${PORT}`,
    // Take a screenshot and keep a trace only when a test fails, to see what went wrong
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  // Only test in Chrome, to keep it quick
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Start the site before the tests run, and stop it after
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Use the example data in src/mocks, so no backend or database is needed
    env: { VITE_USE_MOCKS: 'true' },
    reuseExistingServer: false,
    // Give Vite up to 2 minutes to start (GitHub can be slow)
    timeout: 120_000,
  },
});