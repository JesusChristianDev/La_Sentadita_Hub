import { defineConfig } from '@playwright/test';

try {
  process.loadEnvFile('.env.local');
} catch {}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: process.env.CI
      ? 'node_modules/.bin/next start -p 3000'
      : 'pnpm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      E2E_LOGIN_DELAY_MS: '900',
    },
  },
});
