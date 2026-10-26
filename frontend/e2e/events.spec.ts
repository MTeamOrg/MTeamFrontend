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

const publishedEvent = {
  id: 'e2e-event-id',
  title: 'Jornada M-Team',
  description: 'Encuentro recreativo para socios y entrenadores.',
  startsAt: '2030-10-01T15:00:00.000Z',
  location: 'Sede central',
  imageUrl: '',
  status: 'PUBLISHED',
  displayStatus: 'UPCOMING',
  createdById: 'e2e-admin-id',
}

test('el socio abre Eventos y consulta un evento publicado', async ({ page }) => {
  let eventsQuery: URLSearchParams | undefined

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())

    if (request.method() === 'POST' && requestUrl.pathname.endsWith('/auth/login')) {
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

    if (request.method() === 'GET' && requestUrl.pathname.endsWith('/events')) {
      eventsQuery = requestUrl.searchParams
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [publishedEvent], page: 1, limit: 12, total: 1 }),
      })
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

  await page.getByRole('link', { name: 'Eventos' }).first().click()
  await expect(page).toHaveURL(/\/socio\/eventos$/)
  await expect(page.getByRole('heading', { name: 'Eventos' })).toBeVisible()

  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Jornada M-Team' }) })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Sede central')
  await expect(card.getByRole('img', { name: 'Imagen del evento Jornada M-Team' })).toBeVisible()
  expect(eventsQuery?.get('page')).toBe('1')
  expect(eventsQuery?.get('limit')).toBe('100')
})
