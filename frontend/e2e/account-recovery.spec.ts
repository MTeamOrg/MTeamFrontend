import { expect, test } from '@playwright/test'

const token = 'a'.repeat(64)
const genericMessage = 'Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña.'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.abort())
})

test('solicita enlace, muestra respuesta genérica y limita reenvío', async ({ page }) => {
  await page.route('**/api/auth/password-recovery', route => route.fulfill({ status: 202, json: { message: genericMessage } }))
  await page.goto('/iniciar-sesion')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Correo electrónico').fill('persona@example.com')
  await dialog.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(dialog.getByRole('status')).toHaveText(genericMessage)
  await expect(dialog.getByRole('button', { name: 'Enviar otro enlace' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('envío fallido no muestra éxito y permite volver a intentar', async ({ page }) => {
  await page.route('**/api/auth/password-recovery', route => route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: 'No pudimos enviar el correo. Intentá nuevamente más tarde.' } }))
  await page.goto('/iniciar-sesion')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Correo electrónico').fill('persona@example.com')
  await dialog.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(dialog.getByRole('alert')).toContainText('No pudimos enviar')
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled()
})

test('restablece contraseña desde enlace y elimina token al completar', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/auth/password-recovery/complete', async route => {
    expect(route.request().postDataJSON()).toEqual({ token, newPassword: 'NewPassword123!' })
    expect(route.request().headers()).not.toHaveProperty('authorization')
    await route.fulfill({ status: 204 })
  })
  await page.goto(`/restablecer-contrasena#token=${token}`)
  await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible()
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('NewPassword123!')
  await page.getByLabel('Confirmar nueva contraseña').fill('NewPassword123!')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada')
  await expect(page).toHaveURL(/\/restablecer-contrasena$/)
  expect(errors).toEqual([])
})

for (const [code, message] of [['INVALID_RECOVERY_TOKEN', 'El enlace es inválido o ya fue utilizado. Solicitá uno nuevo.'], ['EXPIRED_RECOVERY_TOKEN', 'El enlace venció. Solicitá uno nuevo.']]) {
  test(`permite pedir otro enlace ante ${code}`, async ({ page }) => {
    await page.route('**/api/auth/password-recovery/complete', route => route.fulfill({ status: 400, json: { code, message } }))
    await page.goto(`/restablecer-contrasena#token=${token}`)
    await page.getByLabel('Nueva contraseña', { exact: true }).fill('NewPassword123!')
    await page.getByLabel('Confirmar nueva contraseña').fill('NewPassword123!')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByRole('alert')).toHaveText(message)
    await page.getByRole('button', { name: 'Solicitar otro enlace' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
}

test('rechaza confirmación distinta sin llamar a la API', async ({ page }) => {
  let hasRequested = false
  await page.route('**/api/auth/password-recovery/complete', async route => { hasRequested = true; await route.abort() })
  await page.goto(`/restablecer-contrasena#token=${token}`)
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('NewPassword123!')
  await page.getByLabel('Confirmar nueva contraseña').fill('AnotherPassword!')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('alert')).toHaveText('Las contraseñas nuevas no coinciden.')
  expect(hasRequested).toBe(false)
})

test('en móvil un enlace incompleto permite pedir otro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/restablecer-contrasena')
  await expect(page.getByRole('alert')).toContainText('El enlace es inválido')
  await page.getByRole('button', { name: 'Solicitar otro enlace' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasOverflow).toBe(false)
})
