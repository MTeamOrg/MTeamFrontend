import { expect, test } from '@playwright/test'

const member = {
  id: 'e2e-member-id',
  firstName: 'Sofia',
  lastName: 'Prueba',
  email: 'member.e2e@m-team.test',
  role: 'MEMBER',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
}

const notifications = [
  {
    id: 'e2e-notification-new',
    userId: member.id,
    title: 'Apto aprobado',
    message: 'Tu apto médico fue aprobado.',
    type: 'MEDICAL_CERTIFICATE_REVIEWED',
    createdAt: '2026-10-15T12:00:00.000Z',
    readAt: null as string | null,
  },
  {
    id: 'e2e-notification-old',
    userId: member.id,
    title: 'Aviso anterior',
    message: 'La sede abrirá en su horario habitual.',
    type: 'GENERAL',
    createdAt: '2026-10-14T12:00:00.000Z',
    readAt: '2026-10-14T12:05:00.000Z',
  },
]

test('el socio consulta notificaciones y marca una como leída', async ({ page }) => {
  let notificationsQuery: URLSearchParams | undefined
  let readStatusRequests = 0

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const path = requestUrl.pathname

    if (request.method() === 'POST' && path.endsWith('/auth/login')) {
      const body = request.postDataJSON() as { email?: string; password?: string }
      if (body.email === member.email && body.password === 'TestPassword123!') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-token-not-valid-outside-this-test',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: member,
          }),
        })
        return
      }
    }

    if (request.method() === 'GET' && path.endsWith('/notifications')) {
      const unreadOnly = requestUrl.searchParams.get('isRead') === 'false'
      if (!unreadOnly) notificationsQuery = requestUrl.searchParams
      const items = unreadOnly ? notifications.filter((notification) => !notification.readAt) : notifications
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, limit: unreadOnly ? 1 : 20, total: items.length }),
      })
      return
    }

    if (request.method() === 'PATCH' && path.endsWith('/notifications/e2e-notification-new/read-status')) {
      readStatusRequests += 1
      notifications[0].readAt = '2026-10-15T12:30:00.000Z'
      await route.fulfill({ status: 204 })
      return
    }

    // Keep this browser test isolated from local and hosted APIs.
    await route.abort()
  })

  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(member.email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/socio$/)

  await page.getByRole('link', { name: 'Notificaciones' }).first().click()
  await expect(page).toHaveURL(/\/socio\/notificaciones$/)
  await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()

  const unread = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Apto aprobado' }) })
  const read = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Aviso anterior' }) })
  await expect(unread).toContainText('No leída')
  await expect(read).toContainText('Leída')
  expect(notificationsQuery?.get('page')).toBe('1')
  expect(notificationsQuery?.get('limit')).toBe('20')

  await unread.getByRole('button', { name: 'Marcar como leída' }).click()
  await expect(page.getByRole('status')).toContainText('Notificación marcada como leída.')
  await expect(unread).toContainText('Leída')
  await expect(unread.getByRole('button', { name: 'Marcar como leída' })).toHaveCount(0)
  await expect(read).toContainText('Leída')
  expect(readStatusRequests).toBe(1)
})
