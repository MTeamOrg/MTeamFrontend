import { expect, test } from '@playwright/test'

for (const width of [1440, 390, 320]) {
  test(`admin user editing at ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      const text = message.text()
      if ((message.type() === 'error' || message.type() === 'warning') && !text.includes('net::ERR_NETWORK_ACCESS_DENIED')) errors.push(text)
    })
    const admin = { id: 'admin', firstName: 'Admin', lastName: 'Prueba', role: 'ADMIN', status: 'ACTIVE', email: 'admin@example.com', isPasswordChangeRequired: false }
    let user = { ...admin, id: 'trainer', firstName: 'Ana', role: 'TRAINER', documentNumber: '30111222', birthDate: '1990-01-02', phone: '1100000000', photoUrl: null, createdAt: '2026-01-01', memberProfile: null, trainerProfile: { specialty: 'Fuerza', description: 'Entrenamiento funcional' }, trainerBranches: [], classes: [], membership: null, payments: [], medicalCertificates: [] }
    const updates: Record<string, unknown>[] = []
    const allowedEntry = { id: 'a1', userId: 'trainer', roleAtAttempt: 'TRAINER', result: 'ALLOWED', denialReason: null, attemptedAt: '2026-10-21T15:30:00Z', branch: { id: 'b1', name: 'Centro' }, accessPoint: { id: 'p1', name: 'Entrada principal' } }
    await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000, user })), admin)
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api', '')
      if (path === '/access-attempts') {
        const isAllowedOnly = new URL(route.request().url()).searchParams.get('result') === 'ALLOWED'
        await route.fulfill({ json: { items: [isAllowedOnly ? allowedEntry : { ...allowedEntry, id: 'a2', result: 'DENIED', denialReason: 'INVALID_QR', attemptedAt: '2026-10-22T16:00:00Z' }], total: 1, page: 1, limit: 1 } })
        return
      }
      if (path === '/users/trainer' && route.request().method() === 'PATCH') {
        const update = route.request().postDataJSON()
        updates.push(update)
        user = { ...user, ...update }
      }
      await route.fulfill({ json: path === '/auth/me' ? admin : path === '/users/trainer' ? user : { items: [], total: 0, page: 1, limit: 100 } })
    })
    await page.goto('/admin/usuarios/trainer')
    await expect(page).toHaveURL(/\/admin\/usuarios\/trainer$/)
    expect(await page.title()).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Ana Prueba' }).first()).toBeVisible()
    const accessCard = page.getByRole('article', { name: 'Último acceso' })
    await expect(accessCard).toHaveCount(1)
    await expect(accessCard.getByText('21/10 · 12:30')).toBeVisible()
    await expect(accessCard.getByText('Centro · Entrada principal')).toBeVisible()
    await page.screenshot({ path: `${process.env.TEMP}/admin-user-access-${width}.png`, fullPage: true })
    const editButton = page.getByRole('button', { name: 'Editar datos', exact: true }).filter({ visible: true })
    await editButton.click()
    const dialog = page.getByRole('dialog', { name: 'Editar datos', exact: true })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Nombre *', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('tab')).toHaveCount(0)
    await dialog.getByLabel('Nombre *', { exact: true }).fill('Andrea')
    await dialog.getByRole('textbox', { name: 'Descripción *', exact: true }).fill('Entrenamiento personalizado')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await page.screenshot({ path: `${process.env.TEMP}/admin-user-edit-${width}.png`, fullPage: false })
    await dialog.getByRole('button', { name: 'Guardar datos', exact: true }).click()
    await expect(page.getByText('Datos actualizados correctamente.')).toBeVisible()
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ firstName: 'Andrea', description: 'Entrenamiento personalizado' })
    expect(updates[0]).not.toHaveProperty('role')
    expect(errors).toEqual([])
  })
}
