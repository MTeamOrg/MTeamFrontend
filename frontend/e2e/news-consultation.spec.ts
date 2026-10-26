import { expect, test } from '@playwright/test'

for (const role of ['MEMBER', 'TRAINER'] as const) {
  for (const width of [1440, 390, 320]) {
    test(`news consultation ${role} ${width}`, async ({ page }) => {
      const base = role === 'MEMBER' ? '/socio' : '/entrenador'
      const user = { id: `news-${role}`, role, firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', status: 'ACTIVE', isPasswordChangeRequired: false }
      const posts = [
        { id: 'shared', title: 'Actividades para la comunidad', content: 'Conocé las propuestas disponibles para participar en la sede. Consultá al equipo para obtener más información.', audience: 'ALL' },
        { id: 'members', title: 'Información para socios', content: 'Las consultas sobre actividades se atienden en recepción.', audience: 'MEMBERS' },
        { id: 'trainers', title: 'Información para entrenadores', content: 'El equipo puede consultar la planificación de actividades.', audience: 'TRAINERS' },
        { id: 'shared-2', title: 'Canales de consulta', content: 'Acercate al equipo de la sede para resolver tus dudas.\nEstamos para acompañarte.', audience: 'ALL' },
      ]
      let mode: 'success' | 'error' | 'empty' = 'success'
      let releaseRequest!: () => void
      const pendingRequest = new Promise<void>((resolve) => { releaseRequest = resolve })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width, height: 1000 })
      await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ user, accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000 })), user)
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
        if (url.pathname.endsWith('/news-posts')) {
          expect(route.request().headers().authorization).toBe('Bearer test')
          expect(url.searchParams.has('audience')).toBe(false)
          await pendingRequest
          if (mode === 'error') return route.fulfill({ status: 500, json: { message: 'No se pudieron consultar las novedades.' } })
          const items = mode === 'empty' ? [] : posts.filter((post) => post.audience === 'ALL' || post.audience === (role === 'MEMBER' ? 'MEMBERS' : 'TRAINERS')).map((post) => ({ ...post, imageUrl: 'https://example.com/not-shown.jpg', status: 'PUBLISHED', publishedAt: '2030-10-15T15:00:00Z', createdById: 'admin' }))
          return route.fulfill({ json: { items, total: items.length, page: 1, limit: 12 } })
        }
        return route.fulfill({ json: { items: [], total: 0, unreadCount: 0, page: 1, limit: 12 } })
      })
      await page.goto(`${base}/novedades`)
      await expect(page.getByRole('status')).toContainText('Cargando novedades…')
      releaseRequest()
      await expect(page.getByRole('article')).toHaveCount(3)
      await expect(page.getByRole('heading', { name: 'Actividades para la comunidad' })).toBeVisible()
      await expect(page.getByRole('heading', { name: role === 'MEMBER' ? 'Información para socios' : 'Información para entrenadores' })).toBeVisible()
      await expect(page.getByRole('heading', { name: role === 'MEMBER' ? 'Información para entrenadores' : 'Información para socios' })).toHaveCount(0)
      await expect(page.locator('.news-consultation-list img')).toHaveCount(0)
      await expect(page.locator('time').first()).toHaveAttribute('datetime', '2030-10-15T15:00:00Z')
      await expect(page.getByRole('button', { name: 'Nueva novedad' })).toHaveCount(0)
      if (width > 700) {
        await expect(page.locator('.app-sidebar').getByRole('link', { name: 'Novedades', exact: true })).toHaveAttribute('aria-current', 'page')
      } else {
        const navigation = page.getByRole('navigation', { name: 'Comunicaciones', exact: true })
        await expect(navigation.getByRole('link', { name: 'Novedades' })).toHaveAttribute('aria-current', 'page')
        const events = navigation.getByRole('link', { name: 'Eventos' })
        await expect(events).toHaveAttribute('href', `${base}/eventos`)
        await events.focus()
        await expect(events).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page).toHaveURL(`${base}/eventos`)
        await page.goBack()
        await expect(page.getByRole('article')).toHaveCount(3)
        await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toHaveCount(1)
      }
      expect(await page.title()).not.toBe('')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${process.env.TEMP}/news-${role}-${width}.png`, fullPage: true })
      mode = 'error'
      await page.reload()
      await expect(page.getByRole('alert')).toContainText('No se pudieron consultar las novedades.')
      await expect(page.getByRole('status')).toHaveCount(0)
      await expect(page.getByText('No hay novedades publicadas para mostrar.')).toHaveCount(0)
      mode = 'empty'
      await page.getByRole('button', { name: 'Reintentar' }).click()
      await expect(page.getByText('No hay novedades publicadas para mostrar.')).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
}
