import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    reporters: process.env.QASE_MODE === 'testops'
      ? [
          ...configDefaults.reporters,
          [
            'vitest-qase-reporter',
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
      : configDefaults.reporters,
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
})
