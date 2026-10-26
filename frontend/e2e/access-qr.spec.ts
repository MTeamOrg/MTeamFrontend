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

test('el socio ve la ayuda de acceso QR y recibe el estado de permiso de cámara denegado', async ({ page }) => {
  let accessAttemptRequests = 0

  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        throw new DOMException('Camera permission denied by the E2E test', 'NotAllowedError')
      },
    })
  })

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

    if (request.method() === 'POST' && requestUrl.pathname.endsWith('/access-attempts')) {
      accessAttemptRequests += 1
    }

    // Keep this browser test isolated from local and hosted APIs.
    await route.abort()
  })

  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(member.email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(/\/socio$/)

  await page.getByRole('link', { name: 'Acceso QR' }).click()
  await expect(page.getByRole('heading', { name: 'Acceso QR' })).toBeVisible()
  await expect(page.getByText('Cómo funciona')).toBeVisible()

  await page.getByRole('button', { name: 'Escanear QR' }).click()
  await expect(page.getByRole('status')).toHaveText('Permiso de cámara denegado')
  await expect(page.getByText(/Abrí los permisos de este sitio/)).toBeVisible()
  expect(accessAttemptRequests).toBe(0)
})
