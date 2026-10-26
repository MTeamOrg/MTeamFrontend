import { createServer } from 'vite'

export default async function globalSetup() {
  // The real-backend browser tests (e2e/real-backend) point the app at a local API instead of the default.
  if (process.env.E2E_REAL_API_URL) process.env.VITE_API_URL = process.env.E2E_REAL_API_URL

  const server = await createServer({
    configFile: './vite.config.ts',
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  })

  await server.listen()

  return async () => {
    await server.close()
  }
}
