import { defineConfig, devices } from '@playwright/test'

const port = 4179

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Primary presentation environment: Windows laptop (1080p) / screen share.
    { name: 'laptop-1080p', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } }, testMatch: /workshop/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // iPad Pro 12.9" landscape, rendered in Chromium.
    {
      name: 'ipad-landscape',
      use: { browserName: 'chromium', viewport: { width: 1366, height: 1024 }, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
