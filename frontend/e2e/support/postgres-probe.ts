import { createRequire } from 'node:module'
import { join } from 'node:path'

interface PgClient {
  connect(): Promise<void>
  query<Row>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>
  end(): Promise<void>
}

export interface DatabaseProbe {
  rows<Row>(sql: string, params?: unknown[]): Promise<Row[]>
  close(): Promise<void>
}

/** Same guard for every access: only a loopback PostgreSQL database with "test" in its name. */
async function connect(config: { backendDir: string; databaseUrl: string }, readOnly: boolean): Promise<DatabaseProbe> {
  const url = new URL(config.databaseUrl)
  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase()
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !databaseName.includes('test')) {
    throw new Error('The database helpers only accept a loopback PostgreSQL database with "test" in its name.')
  }
  const requireFromBackend = createRequire(join(config.backendDir, 'package.json'))
  const { Client } = requireFromBackend('pg') as { Client: new (options: { connectionString: string }) => PgClient }
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()
  if (readOnly) await client.query('SET default_transaction_read_only = on')
  return {
    async rows<Row>(sql: string, params: unknown[] = []) {
      return (await client.query<Row>(sql, params)).rows
    },
    close: () => client.end(),
  }
}

/**
 * Read-only SQL access to the disposable local database used by the real-backend browser tests, so they can
 * check what the screens really stored. It borrows `pg` from the backend folder written in the fixture (no new
 * dependency here), refuses any database that is not a loopback one with "test" in its name, and its session
 * is read-only.
 */
export function openDatabaseProbe(config: { backendDir: string; databaseUrl: string }): Promise<DatabaseProbe> {
  return connect(config, true)
}

/**
 * Write access to the same disposable database, with the same guard. It exists only to prepare states that
 * depend on the clock (a fee that expires seconds from now) or that the screens cannot create (a new pending
 * medical certificate), which the behaviour under test then reacts to. What the application does with them
 * is still checked through the screens and the read-only probe.
 */
export function openDatabaseWriter(config: { backendDir: string; databaseUrl: string }): Promise<DatabaseProbe> {
  return connect(config, false)
}
