import { defineConfig } from '@playwright/test'

const isWindows = process.platform === 'win32'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Real-backend specs share a disposable PostgreSQL fixture, so CI must not run their files concurrently.
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.QASE_MODE === 'testops'
    ? [
        ['list'],
        [
          'playwright-qase-reporter',
          {
            mode: 'testops',
            testops: {
              api: { token: process.env.QASE_TESTOPS_API_TOKEN },
              project: process.env.QASE_TESTOPS_PROJECT,
              run: {
                title: process.env.QASE_TESTOPS_RUN_TITLE,
                complete: true,
              },
            },
          },
        ],
      ]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: isWindows ? { channel: 'msedge' } : undefined,
    trace: 'retain-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
})
