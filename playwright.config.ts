import { defineConfig } from '@playwright/test';

const origin = 'http://127.0.0.1:4179';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: origin,
    browserName: 'chromium',
    // Optional: use an already installed Chrome without downloading Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    }
  ],
  webServer: {
    command: 'node scripts/start.mjs',
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 15_000,
    env: {
      APP_MODE: 'mock',
      APP_ORIGIN: origin,
      HOST: '127.0.0.1',
      PORT: '4179',
      PARTICLE_EVENT_NAME: 'CounterEvent',
      PARTICLE_VARIABLE_NAME: 'counter',
      PARTICLE_FUNCTION_NAME: 'setCounter',
      SHUTDOWN_TIMEOUT: '1'
    }
  }
});
