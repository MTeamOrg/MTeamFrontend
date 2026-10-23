import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 1100 }, { width: 320, height: 1100 }]) {
  test(`member detail presentation ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    const admin = { id: 'admin', firstName: 'Admin', lastName: 'Prueba', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', isPasswordChangeRequired: false }
    const user = { ...admin, id: 'member-1', firstName: 'Marta', lastName: 'Gómez', role: 'MEMBER', documentNumber: '12345678', phone: '1100000000', birthDate: '1990-03-14', createdAt: '2026-07-01', photoUrl: null, memberProfile: { emergencyContactName: 'Elena Gómez', emergencyContactPhone: '1199999999' }, trainerProfile: null, membership: { status: 'ACTIVE', expiresAt: '2026-11-20', paymentId: 'p1' }, payments: [0, 1, 2].map((index) => ({ id: `p${index}`, amount: String(28000 - index * 1000), method: 'Efectivo', receiptNumber: `R-${index}`, status: index === 2 ? 'VOIDED' : 'ACCREDITED', accreditedAt: `2026-0${9 - index}-20T21:42:00Z`, expiresAt: `2026-${10 - index}-20`, createdAt: '2026-07-01', voidReason: index === 2 ? 'Comprobante duplicado' : null })), medicalCertificates: [{ id: 'cert-1', status: 'APPROVED', uploadedAt: '2026-09-01', reviewedAt: '2026-09-02', reviewComment: null }], trainerBranches: [], classes: [] }
    await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test', tokenType: 'Bearer', expiresAt: 9999999999999, user })), admin)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace('/api', '')
      if (path === '/access-attempts') {
        expect(url.searchParams.get('userId')).toBe('member-1')
        expect(url.searchParams.get('result')).toBe('ALLOWED')
      }
      const body = path === '/auth/me' ? admin : path === '/users/member-1' ? user : path === '/access-attempts' ? { items: [{ attemptedAt: '2026-10-21T22:12:00Z', result: 'ALLOWED', branch: { name: 'Sede Centro' }, accessPoint: { name: 'Entrada norte' } }] } : path.endsWith('/audit-logs') ? { items: ['UPDATED', 'CREATED'].map((action, index) => ({ id: `log-${index}`, action, occurredAt: '2026-09-02T17:10:00Z', performedBy: admin, reason: null })) } : { items: [], total: 0 }
      await route.fulfill({ json: body })
    })
    await page.goto('/admin/usuarios/member-1')
    await expect(page).toHaveURL(/\/admin\/usuarios\/member-1$/)
    await expect(page.locator('.member-detail-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Marta Gómez', level: 1 }).filter({ visible: true })).toBeVisible()
    await expect(page.getByText('21/10 · 19:12').filter({ visible: true })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Usuarios', exact: true }).filter({ visible: true }).first()).toHaveAttribute('aria-current', 'page')
    const payButton = page.getByRole('link', { name: 'Registrar pago', exact: true })
    await expect(payButton).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Restablecer contraseña', exact: true })).toBeVisible()
    await expect(page.locator('.user-detail-payment-row')).toHaveCount(3)
    if (viewport.width <= 700) {
      await expect(page.locator('.member-detail-summary .status-card').filter({ visible: true })).toHaveCount(2)
      await expect(page.locator('.member-detail-inline-access')).toBeVisible()
      expect((await payButton.boundingBox())!.y).toBeLessThan((await page.getByRole('button', { name: 'Editar datos' }).boundingBox())!.y)
      expect((await page.getByRole('button', { name: 'Editar datos' }).boundingBox())!.y).toBeLessThan((await page.getByRole('button', { name: 'Restablecer contraseña' }).boundingBox())!.y)
    } else {
      await expect(page.locator('.member-detail-summary .status-card').filter({ visible: true })).toHaveCount(4)
      await expect(page.locator('.member-detail-aside')).toBeVisible()
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${process.env.TEMP}/admin-member-detail-${viewport.width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Editar datos' }).click()
    await expect(page.getByRole('dialog', { name: 'Editar datos' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    expect(errors).toEqual([])
  })
}
