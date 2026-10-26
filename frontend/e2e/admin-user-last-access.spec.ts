import { expect, test } from '@playwright/test'

for (const role of ['MEMBER', 'TRAINER']) {
  for (const width of [1440, 390, 320]) {
    test(`compact last access ${role} ${width}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width, height: 900 })
      const admin = { id: 'admin', firstName: 'Admin', lastName: 'Prueba', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', isPasswordChangeRequired: false }
      const user = { ...admin, id: 'selected-user', firstName: 'Ana', role, documentNumber: '12345678', phone: '1100000000', birthDate: '1990-01-01', createdAt: '2026-01-01', membership: null, payments: [], medicalCertificates: [], trainerBranches: [], classes: [] }
      await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000, user })), admin)
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace('/api', '')
        if (path === '/access-attempts') {
          expect(url.searchParams.get('userId')).toBe('selected-user')
          expect(url.searchParams.get('result')).toBe('ALLOWED')
        }
        await route.fulfill({ json: path === '/auth/me' ? admin : path === '/users/selected-user' ? user : path === '/access-attempts' ? { items: [{ attemptedAt: '2026-10-21T15:30:00Z', result: 'ALLOWED', branch: { name: 'Belgrano' }, accessPoint: { name: 'Molinete 1' } }] } : { items: [], total: 0 } })
      })
      await page.goto('/admin/usuarios/selected-user')
      const card = page.getByRole('article', { name: 'Último acceso', includeHidden: true })
      await expect(card).toHaveCount(1)
      const accessSurface = role === 'MEMBER' && width <= 700 ? page.locator('.member-detail-inline-access') : card
      await expect(accessSurface.getByText('21/10 · 12:30')).toBeVisible()
      await expect(accessSurface.getByText('Belgrano · Molinete 1')).toBeVisible()
      expect(await card.evaluate((element) => Boolean(element.closest('.user-detail-status-grid, .member-detail-summary')))).toBe(true)
      expect((await accessSurface.boundingBox())!.height).toBeLessThan(180)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${process.env.TEMP}/admin-last-access-${role}-${width}.png`, fullPage: false })
      expect(errors).toEqual([])
    })
  }
}
