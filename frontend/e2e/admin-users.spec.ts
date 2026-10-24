import { expect, test } from '@playwright/test'

const admin = { id: 'admin-fixture', firstName: 'Admin', lastName: 'Fixture', email: 'admin@example.test', role: 'ADMIN', status: 'ACTIVE', isPasswordChangeRequired: false }
const users = [
  { id: 'member-fixture', firstName: 'Nombre de prueba extraordinariamente extenso', lastName: 'Apellido de prueba con muchos caracteres', documentNumber: 'DOCUMENTO-DE-PRUEBA-000000000000', email: 'correo-de-prueba-con-un-alias-muy-extenso@example.test', role: 'MEMBER', status: 'ACTIVE' },
  { id: 'trainer-fixture', firstName: 'Entrenador de prueba', lastName: 'Con apellido extenso', documentNumber: 'TRAINER-DOCUMENT-000000', email: 'trainer-with-a-long-email@example.test', role: 'TRAINER', status: 'INACTIVE' },
]

function userDetail(user: typeof users[number]) {
  return { ...admin, ...user, birthDate: '1990-01-02', phone: '1100000000', photoUrl: null, createdAt: '2026-01-01T00:00:00.000Z', memberProfile: user.role === 'MEMBER' ? { emergencyContactName: 'Fixture Contact', emergencyContactPhone: '1199999999' } : null, trainerProfile: user.role === 'TRAINER' ? { specialty: 'Fixture specialty', description: 'Fixture description' } : null, membership: user.role === 'MEMBER' ? { status: 'EXPIRED', paymentId: 'payment-fixture', expiresAt: '2026-01-01T00:00:00.000Z' } : null, payments: [], medicalCertificates: [], trainerBranches: [], classes: [] }
}

for (const width of [1440, 390, 320]) {
  test(`admin users layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await page.addInitScript((sessionUser) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'fixture-token', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3600000, user: sessionUser })), admin)
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname.replace('/api', '')
      const id = path.split('/')[2]
      const body = path === '/auth/me' ? admin
        : path === '/users' && request.method() === 'GET' ? { items: users, page: 1, limit: 20, total: users.length }
          : path === '/users' && request.method() === 'POST' ? { ...userDetail(users[0]), id: 'created-fixture' }
        : path === '/members' ? { items: [{ id: 'member-fixture', membershipStatus: 'EXPIRED' }], page: 1, limit: 1, total: 1 }
        : path.endsWith('/audit-logs') ? { items: [], page: 1, limit: 10, total: 0 }
          : path.startsWith('/users/') && id ? userDetail(users.find((user) => user.id === id) ?? users[0])
              : path === '/access-attempts' ? { items: [], page: 1, limit: 1, total: 0 }
                  : { items: [], total: 0 }
      await route.fulfill({ json: body })
    })

    await page.goto('/admin/usuarios')
    await expect(page).toHaveURL(/\/admin\/usuarios$/)
    await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Editar usuario Nombre de prueba/ }).filter({ visible: true }).first()).toBeVisible()
    if (width > 700) await expect(page.getByText('Vencida', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    else await expect(page.getByText(/cuota vencida/).filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByPlaceholder('Buscar por nombre, documento o correo')).toBeVisible()
    const createButton = page.getByRole('button', { name: 'Crear cuenta', exact: true }).filter({ visible: true }).first()
    await expect(createButton).toBeVisible()
    await createButton.click()
    const dialog = page.getByRole('dialog', { name: 'Crear cuenta' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Las cuentas de entrenador y administrador solo se crean desde acá.')).toBeVisible()
    await expect(dialog.getByLabel('Nombre')).toBeVisible()
    await expect(dialog.getByLabel('Fecha de nacimiento')).toBeVisible()
    await expect(dialog.getByLabel('Correo electrónico')).toHaveAttribute('autocomplete', 'email')
    await expect(dialog.getByRole('textbox', { name: 'Teléfono', exact: true })).toHaveAttribute('autocomplete', 'tel')
    await expect(dialog.getByRole('button', { name: 'Socio' })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('button', { name: 'Administrador' }).click()
    await expect(dialog.getByRole('button', { name: 'Administrador' })).toHaveAttribute('aria-pressed', 'true')
    const dialogBox = await dialog.boundingBox()
    expect(dialogBox).not.toBeNull()
    if (width > 700) {
      expect(dialogBox!.width).toBeLessThanOrEqual(680)
    } else {
      expect(dialogBox!.x).toBe(0)
      expect(dialogBox!.width).toBe(width)
      expect(dialogBox!.y).toBeGreaterThan(0)
      expect(dialogBox!.y + dialogBox!.height).toBe(900)
    }
    await page.screenshot({ path: `${process.env.TEMP}/admin-create-account-${width}.png`, fullPage: false })
    await dialog.getByRole('button', { name: 'Cerrar' }).click()
    await expect(dialog).not.toBeVisible()
    await page.screenshot({ path: `${process.env.TEMP}/admin-users-${width}.png`, fullPage: true })

    if (width > 700) {
      await expect(page.locator('.admin-users-table')).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Cuota' })).toBeVisible()
      const columns = await page.locator('.admin-users-table thead th').count()
      expect(columns).toBe(7)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const columnWidths = await page.locator('.admin-users-table col').evaluateAll((columns) => columns.map((column) => column.getBoundingClientRect().width))
      expect(columnWidths).toHaveLength(7)
      expect(columnWidths[0]).toBeGreaterThan(columnWidths[1])
      expect(columnWidths[2]).toBeGreaterThan(columnWidths[3])
      expect(columnWidths[5]).toBeGreaterThanOrEqual(100)
      expect(columnWidths[6]).toBeGreaterThanOrEqual(100)
      const cellRects = await page.locator('.admin-users-table tbody tr:first-child td').evaluateAll((cells) => cells.map((cell) => ({ left: cell.getBoundingClientRect().left, right: cell.getBoundingClientRect().right })))
      expect(cellRects.every((cell, index) => index === 0 || cell.left >= cellRects[index - 1].right - 0.5)).toBe(true)
      await page.getByRole('link', { name: /Editar usuario Nombre de prueba/ }).filter({ visible: true }).first().click()
      await expect(page).toHaveURL(/\/admin\/usuarios\/member-fixture/)
    } else {
      await expect(page.locator('.admin-users-mobile-list')).toBeVisible()
      await expect(page.locator('.admin-user-mobile-card').filter({ visible: true })).toHaveCount(2)
      const mobileCard = page.locator('.admin-user-mobile-card').filter({ visible: true }).first()
      await expect(mobileCard).toHaveAttribute('href', '/admin/usuarios/member-fixture')
      await expect(mobileCard).not.toContainText('correo-de-prueba-con-un-alias-muy-extenso@example.test')
      await expect(mobileCard).not.toContainText('Editar')
      await expect(mobileCard.locator('img')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await mobileCard.click()
      await expect(page).toHaveURL(/\/admin\/usuarios\/member-fixture/)
      await page.goBack()
      await expect(page.locator('.admin-users-mobile-list')).toBeVisible()
      await page.getByRole('button', { name: 'Mostrar filtros' }).click()
      const filterPanel = page.locator('.admin-users-filter-fields.is-open')
      await expect(filterPanel).toBeVisible()
      await expect(page.getByLabel('Filtrar por rol')).toBeVisible()
      expect((await filterPanel.boundingBox())?.width).toBeLessThanOrEqual(270)
    }

    expect(errors).toEqual([])
  })
}
