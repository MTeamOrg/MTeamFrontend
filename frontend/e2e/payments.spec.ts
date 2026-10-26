import { expect, test } from '@playwright/test'

const admin = {
  id: 'e2e-admin-id',
  firstName: 'Lara',
  lastName: 'Prueba',
  email: 'admin.e2e@m-team.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
}

const member = {
  id: 'e2e-member-id',
  firstName: 'Juan Manuel',
  lastName: 'Perez',
  documentNumber: '40123456',
  email: 'juan.e2e@m-team.test',
}

const initialPayment = {
  id: 'e2e-payment-1',
  amount: '32000',
  method: 'Transferencia',
  receiptNumber: 'REC-001',
  status: 'ACCREDITED',
  accreditedAt: '2026-10-10T14:00:00-03:00',
  expiresAt: '2026-11-09T14:00:00-03:00',
  voidedAt: null,
  voidReason: null,
  member,
}

test('el administrador previsualiza y acredita un pago desde Pagos y cuota', async ({ page }) => {
  const payments = [initialPayment]
  let paymentRequest: Record<string, unknown> | undefined
  let paymentIdempotencyKey: string | undefined

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const path = requestUrl.pathname

    if (request.method() === 'POST' && path.endsWith('/auth/login')) {
      const body = request.postDataJSON() as { email?: string; password?: string }
      if (body.email === admin.email && body.password === 'TestPassword123!') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-token-not-valid-outside-this-test',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: admin,
          }),
        })
        return
      }
    }

    if (request.method() === 'GET' && path.endsWith('/payments/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ from: '', to: '', paymentCount: payments.length, totalAmount: '32000', days: [] }),
      })
      return
    }

    if (request.method() === 'GET' && path.endsWith('/membership-prices/current')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'e2e-price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: admin.id }),
      })
      return
    }

    if (request.method() === 'GET' && path.endsWith('/membership-prices')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: 'e2e-price-1', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: admin.id }], page: 1, limit: 5, total: 1 }),
      })
      return
    }

    if (request.method() === 'GET' && path.endsWith('/admin/dashboard/metrics')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ activeMembers: 1, inactiveMembers: 0, currentMemberships: 1, expiringMemberships: 0, expiredMemberships: 0, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 0 }),
      })
      return
    }

    if (request.method() === 'GET' && path.endsWith('/members')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ ...member, role: 'MEMBER', status: 'ACTIVE', membershipStatus: 'CURRENT', lastPaymentAt: initialPayment.accreditedAt, expiresAt: initialPayment.expiresAt }], page: 1, limit: 100, total: 1 }),
      })
      return
    }

    if (request.method() === 'POST' && path.endsWith('/payments/previews')) {
      const body = request.postDataJSON() as { memberId: string; amount: number; method: string; receiptNumber?: string }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          member,
          currentPrice: '32000',
          amount: String(body.amount),
          method: body.method,
          receiptNumber: body.receiptNumber ?? null,
          estimatedAccreditedAt: '2026-10-15T14:00:00-03:00',
          estimatedExpiresAt: '2026-11-14T14:00:00-03:00',
        }),
      })
      return
    }

    if (request.method() === 'POST' && path.endsWith('/payments')) {
      paymentRequest = request.postDataJSON() as Record<string, unknown>
      paymentIdempotencyKey = request.headers()['idempotency-key']
      const payment = {
        ...initialPayment,
        id: 'e2e-payment-2',
        amount: String(paymentRequest.amount),
        method: String(paymentRequest.method),
        receiptNumber: String(paymentRequest.receiptNumber),
        accreditedAt: '2026-10-15T14:00:00-03:00',
        expiresAt: '2026-11-14T14:00:00-03:00',
      }
      payments.unshift(payment)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(payment) })
      return
    }

    if (request.method() === 'GET' && path.endsWith('/payments')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: payments, page: 1, limit: 20, total: payments.length }),
      })
      return
    }

    // Prevent this test from reaching a local, development, or hosted API.
    await route.abort()
  })

  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(admin.email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/admin/pagos')
  await expect(page.getByRole('heading', { name: 'Pagos y cuota' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(page.getByRole('heading', { name: 'Registrar y acreditar un pago' })).toBeVisible()

  await page.getByRole('combobox', { name: 'Socio' }).selectOption(member.id)
  await page.getByLabel('Número de comprobante').fill('0001-0456')
  await page.getByRole('button', { name: 'Revisar y acreditar' }).click()
  await expect(page.getByText('Nuevo vencimiento')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar y acreditar' }).click()

  await expect(page.getByRole('dialog')).toBeHidden()
  const paymentRows = page.locator('.payment-table tbody tr')
  await expect(paymentRows).toHaveCount(2)
  await expect(paymentRows.filter({ hasText: 'Juan Manuel Perez' })).toHaveCount(2)
  expect(paymentRequest).toEqual({ memberId: member.id, amount: 32000, method: 'Efectivo', receiptNumber: '0001-0456' })
  expect(paymentIdempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
})
