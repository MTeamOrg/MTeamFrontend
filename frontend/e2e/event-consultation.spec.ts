import { expect, test } from '@playwright/test'

for (const role of ['MEMBER', 'TRAINER'] as const) {
  for (const width of [1440, 390, 320]) {
    test(`event consultation ${role} ${width}`, async ({ page }) => {
      const base = role === 'MEMBER' ? '/socio' : '/entrenador'
      const user = { id: `events-${role}`, role, firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', status: 'ACTIVE', isPasswordChangeRequired: false }
      const events = Array.from({ length: 5 }, (_, index) => ({
        id: String(index), title: `Encuentro de actividad ${index + 1}`, description: 'Actividad de la comunidad.',
        startsAt: '2030-11-05T18:00:00Z', location: 'Salón de actividades', imageUrl: '',
        status: index === 4 ? 'CANCELLED' : 'PUBLISHED', displayStatus: index === 4 ? 'CANCELLED' : index === 3 ? 'FINISHED' : 'UPCOMING', createdById: 'admin',
      }))
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        const text = message.text()
        if (message.type() === 'error' && !text.includes('net::ERR_NETWORK_ACCESS_DENIED')) errors.push(text)
      })
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ user, accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000 })), user)
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
        const search = url.searchParams.get('search')?.toLowerCase() ?? ''
        const items = url.pathname.endsWith('/events') ? events.filter((event) => event.title.toLowerCase().includes(search)) : []
        await route.fulfill({ json: { items, total: items.length, page: 1, limit: 100, unreadCount: 0 } })
      })
      await page.goto(`${base}/eventos`)
      await expect(page).toHaveURL(`${base}/eventos`)
      expect(await page.title()).not.toBe('')
      await expect(page.getByRole('article')).toHaveCount(3)
      if (width > 700) {
        await expect(page.locator('.app-sidebar').getByRole('link', { name: 'Eventos', exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(page.getByRole('button', { name: 'Próximos', exact: true })).toHaveAttribute('aria-pressed', 'true')
        expect(await page.locator('.event-consultation-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3)
      } else {
        await expect(page.getByRole('link', { name: 'Volver', exact: true })).toHaveAttribute('href', base)
        await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toHaveCount(1)
        if (role === 'TRAINER') await expect(page.getByRole('navigation', { name: 'Navegación inferior' }).getByRole('link', { name: 'Eventos' })).toHaveAttribute('aria-current', 'page')
        await page.getByRole('searchbox', { name: 'Buscar evento' }).fill('actividad 2')
        await page.getByRole('searchbox', { name: 'Buscar evento' }).press('Enter')
        await expect(page.getByRole('article')).toHaveCount(1)
        await expect(page.getByRole('heading', { name: 'Encuentro de actividad 2' })).toBeVisible()
        await page.getByRole('searchbox').clear()
        await page.getByRole('searchbox').press('Enter')
        await expect(page.getByRole('article')).toHaveCount(3)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${process.env.TEMP}/events-${role}-${width}.png`, fullPage: true })
      if (width > 700) await page.getByRole('button', { name: 'Finalizados', exact: true }).click()
      else {
        await page.getByRole('button', { name: 'Filtrar eventos: Próximos' }).click()
        await expect(page.getByRole('radio', { name: 'Próximos' })).toBeFocused()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Filtrar eventos: Próximos' })).toBeFocused()
        await page.keyboard.press('Enter')
        await page.getByRole('radio', { name: 'Finalizados' }).click()
      }
      await expect(page.getByRole('heading', { name: 'Encuentro de actividad 4' })).toBeVisible()
      await expect(page.getByRole('article')).toHaveCount(1)
      if (width > 700) await page.getByRole('button', { name: 'Cancelados', exact: true }).click()
      else {
        await page.getByRole('button', { name: 'Filtrar eventos: Finalizados' }).click()
        await page.getByRole('radio', { name: 'Cancelados' }).click()
      }
      await expect(page.getByRole('heading', { name: 'Encuentro de actividad 5' })).toBeVisible()
      expect(errors).toEqual([])
    })
  }
}
