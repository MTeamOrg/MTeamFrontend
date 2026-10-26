import { expect, test } from '@playwright/test'

for (const width of [1440, 390, 320]) {
  test(`admin news ${width}`, async ({ page }) => {
    const user = { id: 'admin', role: 'ADMIN', firstName: 'Ana', lastName: 'Prueba', email: 'ana@example.com', status: 'ACTIVE', isPasswordChangeRequired: false }
    const posts = Array.from({ length: 5 }, (_, index) => ({ id: String(index), title: `Comunicado de actividades ${index + 1}`, content: 'Información de la comunidad.', audience: index === 2 ? 'MEMBERS' : index === 3 ? 'TRAINERS' : 'ALL', status: index === 4 ? 'DRAFT' : 'PUBLISHED', publishedAt: index === 4 ? null : '2030-10-10T12:00:00Z', imageUrl: index === 0 ? 'https://example.com/keep.jpg' : null, createdById: 'admin' }))
    const updates: Record<string, unknown>[] = []
    const creations: Record<string, unknown>[] = []
    const queries: URLSearchParams[] = []
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript((user) => sessionStorage.setItem('mteam.auth', JSON.stringify({ user, accessToken: 'test', tokenType: 'Bearer', expiresIn: 3600, expiresAt: Date.now() + 3_600_000 })), user)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: user })
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        creations.push(body)
        const created = { ...posts[0], ...body, id: String(posts.length), publishedAt: body.status === 'PUBLISHED' ? '2030-10-11T12:00:00Z' : null }
        posts.push(created)
        return route.fulfill({ status: 201, json: created })
      }
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON()
        updates.push(body)
        Object.assign(posts[0], body)
        return route.fulfill({ json: posts[0] })
      }
      const search = url.searchParams.get('search') ?? ''
      queries.push(url.searchParams)
      const items = posts.filter((post) => post.title.includes(search) && (!url.searchParams.get('audience') || post.audience === url.searchParams.get('audience')) && (!url.searchParams.get('status') || post.status === url.searchParams.get('status')))
      return route.fulfill({ json: { items, total: items.length, page: 1, limit: 12 } })
    })
    await page.goto('/admin/novedades')
    await expect(page.locator('[data-news-post]')).toHaveCount(5)
    await expect(page.locator('img')).toHaveCount(0)
    if (width > 700) {
      await expect(page.locator('.app-sidebar').getByRole('link', { name: 'Novedades', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Nueva novedad' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Título' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible()
      const firstRow = page.locator('[data-news-post]').first()
      await firstRow.getByLabel('Acciones de Comunicado de actividades 1').click()
      await expect(firstRow.getByRole('button', { name: 'Editar' })).toBeVisible()
      await expect(firstRow.getByRole('button', { name: 'Desactivar' })).toBeVisible()
      await expect(firstRow.getByRole('button', { name: 'Publicar' })).toHaveCount(0)
      await firstRow.locator('summary').click()
      expect(await page.locator('.admin-news-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2)
    } else {
      await expect(page.getByRole('button', { name: 'Publicar una novedad' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/admin')
      await expect(page.getByRole('navigation', { name: 'Navegación inferior' })).toHaveCount(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `${process.env.TEMP}/admin-news-${width}.png`, fullPage: true })
    await page.getByRole('searchbox').fill('actividades 2')
    await page.getByRole('searchbox').press('Enter')
    await expect(page.locator('[data-news-post]')).toHaveCount(1)
    await page.getByRole('searchbox').clear()
    await page.getByRole('searchbox').press('Enter')
    if (width < 701) await page.getByRole('button', { name: 'Filtrar novedades' }).click()
    await page.getByRole('combobox', { name: 'Filtrar por audiencia', exact: true }).selectOption('MEMBERS')
    await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('PUBLISHED')
    await expect(page.locator('[data-news-post]')).toHaveCount(1)
    await expect.poll(() => queries.at(-1)?.get('audience')).toBe('MEMBERS')
    await expect.poll(() => queries.at(-1)?.get('status')).toBe('PUBLISHED')
    await page.getByRole('combobox', { name: 'Filtrar por audiencia', exact: true }).selectOption('')
    await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('')
    if (width < 701) {
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Filtrar novedades' })).toBeFocused()
    }
    await expect(page.locator('[data-news-post]')).toHaveCount(5)
    const editButton = page.getByRole('button', { name: 'Comunicado de actividades 1', exact: true })
    await editButton.click()
    await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue('Comunicado de actividades 1')
    await expect(page.getByLabel(/Imagen/)).toHaveCount(0)
    if (width < 701) {
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(editButton).toBeFocused()
      await editButton.click()
    }
    await page.getByRole('textbox', { name: 'Contenido', exact: true }).fill('Contenido actualizado.')
    if (width < 701) await page.screenshot({ path: `${process.env.TEMP}/admin-news-form-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(page.getByText('Cambios guardados correctamente.')).toBeVisible()
    expect(updates[0]).not.toHaveProperty('imageUrl')
    expect(posts[0].imageUrl).toBe('https://example.com/keep.jpg')
    if (width < 701) await page.getByRole('button', { name: 'Publicar una novedad' }).click()
    await page.getByRole('textbox', { name: 'Título', exact: true }).fill('Información adicional')
    await page.getByRole('textbox', { name: 'Contenido', exact: true }).fill('Contenido de la nueva publicación.')
    await page.getByRole('radio', { name: 'Entrenadores', exact: true }).check()
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Publicar', exact: true }).click()
    await expect(page.getByText('Novedad publicada correctamente.')).toBeVisible()
    expect(creations[0]).toMatchObject({ imageUrl: null, status: 'PUBLISHED', audience: 'TRAINERS' })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}
