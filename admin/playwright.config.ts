import { defineConfig, devices } from '@playwright/test'

const origin = `http://localhost:${process.env.PORT || '8080'}`

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `${origin}/admin/`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'go run ./cmd/api',
    cwd: '..',
    url: `${origin}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
