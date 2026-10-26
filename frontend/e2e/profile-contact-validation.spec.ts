import { expect, test } from '@playwright/test'

for (const role of ['MEMBER', 'TRAINER'] as const) {
  for (const width of [1440, 390]) {
    test(`contact validation ${role} ${width}`, async ({ page }) => {
      test.setTimeout(60000)
      await page.setViewportSize({ width, height: 1000 })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const user = { id: 'trainer-own', firstName: 'Ana', lastName: 'Prueba', role, status: 'ACTIVE', email: 'ana@example.com', isPasswordChangeRequired: false }
      let profile = { ...user, documentNumber: '12345678', birthDate: '1990-01-01', photoUrl: null, phone: '1100000000', memberProfile: role === 'MEMBER' ? { emergencyContactName: 'Ana', emergencyContactPhone: '1199999999' } : null, trainerProfile: { specialty: 'Entrenamiento funcional', description: 'Preparación física y movilidad.' } }
      const updates: unknown[] = []
      await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000, user })), user)
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname.replace('/api', '')
        if (path === '/users/me' && route.request().method() === 'PATCH') {
          const update = route.request().postDataJSON()
          updates.push(update); profile = { ...profile, ...update }
        }
        if (path === '/members/me/membership') {
          await route.fulfill({ json: { currentPrice: '25000', lastPaymentAt: null, expiresAt: null, daysRemaining: 0, status: 'EXPIRED' } })
          return
        }
        if (path === '/members/me/medical-certificates') {
          await route.fulfill({ json: { items: [], total: 0, page: 1, limit: 20, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } } })
          return
        }
        const body = path === '/auth/me' || path === '/users/me' ? profile : path === '/trainers' ? { items: [{ ...profile, branches: [{ id: 'b1', name: 'Sede Norte', address: 'Calle 123' }, { id: 'b2', name: 'Sede Sur', address: 'Calle 456' }] }], total: 1, page: 1, limit: 100 } : { items: [], total: 0, page: 1, limit: 20 }
        await route.fulfill({ json: body })
      })
      await page.goto(role === 'MEMBER' ? '/socio/perfil' : '/entrenador/perfil')
      await expect(page).toHaveURL(role === 'MEMBER' ? /\/socio\/perfil$/ : /\/entrenador\/perfil$/)
      await expect(page.getByRole('heading', { name: 'Ana Prueba' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width < 701) {
        await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toHaveCount(1)
        await expect(page.getByRole('textbox')).toHaveCount(0)
        await page.getByRole('button', { name: role === 'TRAINER' ? 'Editar mi perfil' : 'Editar datos' }).click()
      }
      await page.getByLabel('Correo electrónico').fill('ana@example')
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
      await expect(page.locator('[aria-invalid="true"]')).toHaveCount(1)
      await expect(page.getByRole('alert')).toBeVisible()
      expect(updates).toEqual([])
      await expect(page.getByText('Cambios guardados correctamente.')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${process.env.TEMP}/contact-validation-${role}-${width}.png`, fullPage: true })
      await page.getByRole('textbox').first().fill('updated@example.com')
      await page.getByRole('button', { name: 'Guardar cambios' }).click()
      await expect(page.getByText('Cambios guardados correctamente.')).toBeVisible()
      expect(updates).toEqual([{ email: 'updated@example.com', phone: '1100000000', ...(role === 'MEMBER' ? { emergencyContactName: 'Ana', emergencyContactPhone: '1199999999' } : {}) }])
      if (role === 'TRAINER' && width < 701) await page.getByRole('button', { name: 'Cancelar' }).click()
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${process.env.TEMP}/contact-success-${role}-${width}.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }

}
