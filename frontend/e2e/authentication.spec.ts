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

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())

    if (request.method() === 'POST' && requestUrl.pathname.endsWith('/auth/login')) {
      const body = request.postDataJSON() as { email?: string; password?: string }

      if (body.email === 'slow-admin.e2e@m-team.test' && body.password === 'TestPassword123!') {
        await new Promise((resolve) => setTimeout(resolve, 600))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'e2e-slow-token-not-valid-outside-this-test',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: { ...admin, email: body.email },
          }),
        })
        return
      }

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

      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_CREDENTIALS',
          message: 'Correo o contraseña incorrectos.',
          details: null,
        }),
      })
      return
    }

    // Keep this browser test isolated: no request reaches a developer or hosted API.
    await route.abort()
  })
})

test('inicia sesión y abre el panel correspondiente al rol', async ({ page }) => {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(admin.email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill('TestPassword123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: /Lara/ })).toBeVisible()
  await expect(page.getByText('PANEL ADMINISTRATIVO')).toBeVisible()
})

test('muestra el error del backend cuando las credenciales no son válidas', async ({ page }) => {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill('persona@m-team.test')
  await page.getByPlaceholder('Ingresá tu contraseña').fill('Incorrecta123!')
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos')
  await expect(page).toHaveURL(/\/iniciar-sesion$/)
})

test('muestra un spinner blanco animado durante un login lento', async ({ page }) => {
  await page.goto('/iniciar-sesion')
  await page.locator('input[type="email"]').fill('slow-admin.e2e@m-team.test')
  await page.locator('input[type="password"]').fill('TestPassword123!')

  const button = page.locator('button.login-button')
  await button.click()

  await expect(button).toHaveAttribute('aria-busy', 'true')
  const spinner = button.locator('.action-spinner')
  await expect(spinner).toBeVisible()
  await expect(button).toContainText(/Entrando/)
  await expect.poll(() => spinner.evaluate((element) => {
    const style = getComputedStyle(element)
    return { animationName: style.animationName, width: style.width, height: style.height, borderTopColor: style.borderTopColor }
  })).toEqual(expect.objectContaining({ animationName: 'login-spin', width: '18px', height: '18px' }))

  await expect(page).toHaveURL(/\/admin$/)
})
