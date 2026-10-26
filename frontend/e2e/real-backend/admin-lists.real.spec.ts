import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { openDatabaseWriter, type DatabaseProbe } from '../support/postgres-probe'

const apiUrl = process.env.E2E_REAL_API_URL
const fixturePath = process.env.E2E_REAL_FIXTURE
const ACCESS_POINT_NAME = 'Punto E2E bandejas administrativas'
const CERTIFICATE_FILE_URL = 'e2e/admin-lists-medical-certificate.pdf'
const FILTER_DATE = '2092-03-03'

interface Fixture {
  password: string
  admin: { id: string; email: string }
  otherMember: { id: string; email: string }
  branch: { id: string; name: string }
  backendDir: string
  databaseUrl: string
}

async function loginAsAdministrator(page: Page, fixture: Fixture) {
  await page.goto('/iniciar-sesion')
  await page.locator('input[type="email"]').fill(fixture.admin.email)
  await page.locator('input[type="password"]').fill(fixture.password)
  await page.getByRole('button', { name: /Iniciar sesi/ }).click()
  await expect(page).toHaveURL(/\/admin(?:\/|$)/)
}

test.describe('[backend y PostgreSQL reales] bandejas administrativas', () => {
  test.skip(!apiUrl || !fixturePath, 'Define E2E_REAL_API_URL y E2E_REAL_FIXTURE para ejecutar la verificación real.')
  test.describe.configure({ mode: 'serial' })

  let fixture: Fixture
  let writer: DatabaseProbe
  let accessPointId: string
  let allowedLogId: string
  let deniedLogId: string
  let certificateId: string

  test.beforeAll(async () => {
    fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture
    if (!fixture.backendDir || !fixture.databaseUrl) {
      throw new Error('El fixture no identifica la base PostgreSQL local de pruebas. Volvé a generarlo con el seed E2E del backend.')
    }
    writer = await openDatabaseWriter({ backendDir: fixture.backendDir, databaseUrl: fixture.databaseUrl })

    accessPointId = randomUUID()
    allowedLogId = randomUUID()
    deniedLogId = randomUUID()
    certificateId = randomUUID()

    // These deterministic markers let the test remove leftovers if a previous run was interrupted.
    await writer.rows('DELETE FROM access_log WHERE access_point_id IN (SELECT id FROM access_point WHERE branch_id = $1 AND name = $2)', [fixture.branch.id, ACCESS_POINT_NAME])
    await writer.rows('DELETE FROM access_point WHERE branch_id = $1 AND name = $2', [fixture.branch.id, ACCESS_POINT_NAME])
    await writer.rows('DELETE FROM medical_certificate WHERE file_url = $1', [CERTIFICATE_FILE_URL])

    await writer.rows(
      `INSERT INTO access_point (id, branch_id, name, qr_token, is_active)
       VALUES ($1, $2, $3, $4, true)`,
      [accessPointId, fixture.branch.id, ACCESS_POINT_NAME, `e2e-admin-list-${randomUUID()}`],
    )
    await writer.rows(
      `INSERT INTO access_log (id, user_id, role_at_attempt, branch_id, access_point_id, result, denial_reason, attempted_at)
       VALUES ($1, $2, 'MEMBER', $3, $4, 'ALLOWED', NULL, $5),
              ($6, $2, 'MEMBER', $3, $4, 'DENIED', 'EXPIRED_MEMBERSHIP', $7)`,
      [allowedLogId, fixture.otherMember.id, fixture.branch.id, accessPointId,
        `${FILTER_DATE}T15:30:00.000Z`, deniedLogId, `${FILTER_DATE}T16:30:00.000Z`],
    )
    await writer.rows(
      `INSERT INTO medical_certificate (id, member_id, file_url, status, uploaded_at)
       VALUES ($1, $2, $3, 'PENDING', $4)`,
      [certificateId, fixture.otherMember.id, CERTIFICATE_FILE_URL, `${FILTER_DATE}T15:00:00.000Z`],
    )
  })

  test.afterAll(async () => {
    if (writer) {
      await writer.rows('DELETE FROM access_log WHERE id = ANY($1::uuid[])', [[allowedLogId, deniedLogId].filter(Boolean)])
      if (certificateId) await writer.rows('DELETE FROM medical_certificate WHERE id = $1', [certificateId])
      if (accessPointId) await writer.rows('DELETE FROM access_point WHERE id = $1', [accessPointId])
      await writer.close()
    }
  })

  test('el administrador filtra accesos reales por socio, rol, sede, resultado y fecha', async ({ page }) => {
    await loginAsAdministrator(page, fixture)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/accesos')
    await expect(page.locator('.access-mobile-list')).toBeVisible()
    await page.getByRole('button', { name: 'Mostrar filtros' }).click()
    await expect(page.locator('.access-filter-fields.is-open')).toBeVisible()
    await expect(page.locator('.access-mobile-card').filter({ hasText: fixture.branch.name })).toHaveCount(2)

    await page.getByLabel('Buscar por usuario o documento').fill('E2E-OTRO.SOCIO')
    await page.getByLabel('Filtrar por rol').selectOption('MEMBER')
    await page.getByLabel('Filtrar por sede').selectOption(fixture.branch.id)
    await page.getByLabel('Filtrar por resultado').selectOption('DENIED')
    await page.getByLabel('Desde').fill(FILTER_DATE)
    await page.getByLabel('Hasta').fill(FILTER_DATE)
    await page.getByLabel('Buscar por usuario o documento').press('Enter')

    const deniedAttempt = page.locator('.access-mobile-card').filter({ hasText: 'Omar Otro' })
    await expect(deniedAttempt).toHaveCount(1)
    await expect(deniedAttempt).toContainText(fixture.branch.name)
    await expect(deniedAttempt).toContainText('Rechazado')
    await expect(deniedAttempt).toContainText('Cuota vencida')
    await expect(page.getByText('1 intento')).toBeVisible()
  })

  test('el administrador filtra aptos reales por socio, estado y fecha', async ({ page }) => {
    await loginAsAdministrator(page, fixture)
    await page.goto('/admin/aptos')
    await expect(page.getByRole('heading', { name: /Aptos/ })).toBeVisible()
    await expect(page.getByText('E2E-OTRO.SOCIO').first()).toBeVisible()

    await page.getByLabel('Buscar por socio o documento').fill('E2E-OTRO.SOCIO')
    await page.getByLabel('Filtrar por estado').selectOption('PENDING')
    await page.getByLabel('Fecha desde').fill(FILTER_DATE)
    await page.getByLabel('Fecha hasta').fill(FILTER_DATE)
    await page.getByLabel('Buscar por socio o documento').press('Enter')

    const certificateRow = page.getByRole('row').filter({ hasText: 'E2E-OTRO.SOCIO' })
    await expect(certificateRow).toHaveCount(1)
    await expect(certificateRow).toContainText('Pendiente')
    await expect(page.getByText('Mostrando 1 de 1')).toBeVisible()
  })
})
