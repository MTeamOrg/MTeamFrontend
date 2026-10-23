import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`trainer home ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-09-07T15:00:00-03:00') })
    const user = { id: 'trainer-id', firstName: 'Carla', lastName: 'Giménez', role: 'TRAINER', status: 'ACTIVE', email: 'trainer@example.com', isPasswordChangeRequired: false }
    await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: 9999999999999, user })), user)
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api', '')
      const emptyPage = { items: [], page: 1, limit: 3, total: 0 }
      const body = path === '/auth/me' ? user : path === '/trainer/classes' ? { id: 's', weekStartsOn: '2026-09-07', classes: [{ id: 'c', activity: 'Funcional', day: '2026-09-07', startsAt: '2026-09-07T18:00:00-03:00', startTime: '18:00', trainer: user, branch: { id: 'b', name: 'Belgrano' } }] } : path === '/branches' ? { ...emptyPage, items: [{ id: 'b', name: 'Belgrano', address: 'Av. Cabildo 2350, CABA', openingHours: 'Lun a Vie 8:30–23:30', phone: '+54 11 4783-1200', imageUrl: '', isActive: true }] } : emptyPage
      await route.fulfill({ json: body })
    })
    await page.goto('/entrenador')
    await expect(page.getByRole('heading', { name: '¡Hola, Carla!' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Funcional' })).toBeVisible()
    await expect(page.locator('.trainer-status-grid .status-card')).toHaveCount(viewport.width < 701 ? 2 : 4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${process.env.TEMP}/trainer-dashboard-${viewport.width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Abrir escáner QR' }).click()
    await expect(page).toHaveURL(/\/entrenador\/acceso$/)
    await expect(page.getByRole('heading', { name: viewport.width < 701 ? 'Acceso al gimnasio' : 'Acceso QR' })).toBeVisible()
    expect(errors).toEqual([])
  })
}
