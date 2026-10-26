import { defineConfig } from '@playwright/test'

// The roll-flow smoke test in e2e/. Run it with `npm run test:e2e`, which asks for the two test
// logins (see scripts/e2e.mjs). It uses the Mac's own Chrome, so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180/dnd-table/',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180/dnd-table/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
