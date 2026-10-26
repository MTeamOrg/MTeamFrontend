import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { request as playwrightRequest, expect, test } from '@playwright/test'
import { openDatabaseProbe, type DatabaseProbe } from '../support/postgres-probe'

const apiUrl = process.env.E2E_REAL_API_URL
const fixturePath = process.env.E2E_REAL_FIXTURE

interface Fixture {
  password: string
  admin: { id: string; email: string }
  member: { id: string; email: string }
  backendDir: string
  databaseUrl: string
}

interface Membership {
  status: string
  expiresAt: string | null
}

test.describe('[backend y PostgreSQL reales] pagos', () => {
  test.skip(!apiUrl || !fixturePath, 'Define E2E_REAL_API_URL y E2E_REAL_FIXTURE para ejecutar la verificación real.')
  test.setTimeout(60_000)

  test('acredita una vez al reintentar, permite anular y restaura la vigencia anterior', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture
    const api = await playwrightRequest.newContext()
    let db: DatabaseProbe | undefined

    try {
      db = await openDatabaseProbe({ backendDir: fixture.backendDir, databaseUrl: fixture.databaseUrl })
      const adminLogin = await api.post(apiUrl + '/auth/login', {
        data: { email: fixture.admin.email, password: fixture.password },
      })
      expect(adminLogin.status()).toBe(200)
      const adminSession = await adminLogin.json() as { accessToken: string }
      const adminHeaders = { Authorization: 'Bearer ' + adminSession.accessToken }

      const memberLogin = await api.post(apiUrl + '/auth/login', {
        data: { email: fixture.member.email, password: fixture.password },
      })
      expect(memberLogin.status()).toBe(200)
      const memberSession = await memberLogin.json() as { accessToken: string }
      const memberHeaders = { Authorization: 'Bearer ' + memberSession.accessToken }

      const beforeResponse = await api.get(apiUrl + '/members/me/membership', { headers: memberHeaders })
      expect(beforeResponse.status()).toBe(200)
      const before = await beforeResponse.json() as Membership
      expect(before.status).toBe('EXPIRING_SOON')
      expect(before.expiresAt).toBeTruthy()

      const body = {
        memberId: fixture.member.id,
        amount: 25123.45,
        method: 'CASH',
        receiptNumber: 'E2E-' + randomUUID(),
      }
      const idempotencyKey = randomUUID()
      const createOptions = {
        headers: { ...adminHeaders, 'Idempotency-Key': idempotencyKey },
        data: body,
      }

      const firstResponse = await api.post(apiUrl + '/payments', createOptions)
      expect(firstResponse.status()).toBe(201)
      const first = await firstResponse.json() as { id: string; status: string }
      expect(first.status).toBe('ACCREDITED')

      const retryResponse = await api.post(apiUrl + '/payments', createOptions)
      expect(retryResponse.status()).toBe(201)
      const retry = await retryResponse.json() as { id: string; status: string }
      expect(retry.id).toBe(first.id)

      const conflictResponse = await api.post(apiUrl + '/payments', {
        ...createOptions,
        data: { ...body, amount: body.amount + 1 },
      })
      expect(conflictResponse.status()).toBe(409)

      const afterAccreditationResponse = await api.get(apiUrl + '/members/me/membership', { headers: memberHeaders })
      expect(afterAccreditationResponse.status()).toBe(200)
      const afterAccreditation = await afterAccreditationResponse.json() as Membership
      expect(afterAccreditation.status).toBe('CURRENT')
      expect(Date.parse(afterAccreditation.expiresAt!)).toBeGreaterThan(Date.parse(before.expiresAt!))

      const voidResponse = await api.post(apiUrl + '/payments/' + first.id + '/voids', {
        headers: adminHeaders,
        data: { reason: 'Anulación sintética de Playwright' },
      })
      expect(voidResponse.status()).toBe(200)
      const voided = await voidResponse.json() as { id: string; status: string; voidedAt: string | null }
      expect(voided).toMatchObject({ id: first.id, status: 'VOIDED' })
      expect(voided.voidedAt).toBeTruthy()

      const retryAfterVoid = await api.post(apiUrl + '/payments', createOptions)
      expect(retryAfterVoid.status()).toBe(201)
      const replayAfterVoid = await retryAfterVoid.json() as { id: string; status: string }
      expect(replayAfterVoid).toMatchObject({ id: first.id, status: 'VOIDED' })

      const afterVoidResponse = await api.get(apiUrl + '/members/me/membership', { headers: memberHeaders })
      expect(afterVoidResponse.status()).toBe(200)
      const afterVoid = await afterVoidResponse.json() as Membership
      expect(afterVoid.status).toBe(before.status)
      expect(Date.parse(afterVoid.expiresAt!)).toBe(Date.parse(before.expiresAt!))

      const rows = await db.rows<{ count: number }>(
        'SELECT count(*)::int AS count FROM payment WHERE idempotency_key = $1 AND member_id = $2',
        [idempotencyKey, fixture.member.id],
      )
      expect(rows[0]?.count).toBe(1)
    } finally {
      await db?.close()
      await api.dispose()
    }
  })
})
