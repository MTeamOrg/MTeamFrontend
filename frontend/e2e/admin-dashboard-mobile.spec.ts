import { expect, test } from '@playwright/test'

const ADMIN = {
  id: 'dashboard-admin-fixture',
  firstName: 'Admin',
  lastName: 'Fixture',
  email: 'admin.dashboard@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
}

test('muestra las tarjetas administrativas del panel en celular', async ({ page }) => {
  let copyCalled = false
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date('2026-09-07T15:00:00-03:00') })
  await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3600000, user })), ADMIN)
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api', '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path.endsWith('/auth/me')) return json(ADMIN)
    if (path.endsWith('/admin/dashboard/metrics')) return json({ activeMembers: 3, inactiveMembers: 1, currentMemberships: 2, expiringMemberships: 1, expiredMemberships: 0, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 1 })
    if (path.endsWith('/payments/summary')) return json({ from: '', to: '', paymentCount: 0, totalAmount: '0', days: [] })
    if (path.endsWith('/access-attempts')) return json({ items: [], page: 1, limit: 4, total: 0 })
    if (request.method() === 'POST' && path.endsWith('/weekly-schedules/schedule-current/copies')) {
      copyCalled = true
      return json({ id: 'schedule-next', weekStartsOn: '2026-09-14', classes: [] }, 201)
    }
    if (path.endsWith('/weekly-schedules')) {
      if (copyCalled && url.searchParams.get('weekStartsOn') === '2026-09-14') return json({ id: 'schedule-next', weekStartsOn: '2026-09-14', classes: [] })
      return url.searchParams.get('weekStartsOn') === '2026-09-14'
        ? json({ id: null, weekStartsOn: '2026-09-14', classes: [] })
        : json({ id: 'schedule-current', weekStartsOn: '2026-09-07', classes: [] })
    }
    return route.abort()
  })

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Período inicial de 20 días' })).toBeVisible()
  await expect(page.getByText('1 socio')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible()
  await expect(page.getByText('Sin generar')).toBeVisible()
  await page.screenshot({ path: `${process.env.TEMP}/admin-dashboard-mobile-before-copy.png`, fullPage: true })
  const button = page.getByRole('button', { name: 'Generar desde la semana anterior' })
  await button.click()
  await expect(page.getByText('Se generó el cronograma de la semana siguiente.')).toBeVisible()
  await expect(page.getByText('Generado')).toBeVisible()
  expect(copyCalled).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: `${process.env.TEMP}/admin-dashboard-mobile.png`, fullPage: true })
})
