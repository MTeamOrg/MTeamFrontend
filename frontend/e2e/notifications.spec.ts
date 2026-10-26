import { expect, test, type Page } from '@playwright/test'
import { FakeNotificationsApi, PASSWORD, type FakeUser } from './support/fake-notifications-api'

const sofia: FakeUser = { id: 'e2e-member-sofia', email: 'sofia.e2e@m-team.test', role: 'MEMBER', firstName: 'Sofía', lastName: 'Prueba' }
const tomas: FakeUser = { id: 'e2e-trainer-tomas', email: 'tomas.e2e@m-team.test', role: 'TRAINER', firstName: 'Tomás', lastName: 'Prueba' }

async function login(page: Page, user: FakeUser) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(user.email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).toHaveURL(user.role === 'MEMBER' ? /\/socio$/ : /\/entrenador$/)
}

const menuEntry = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: /Notificaciones/ })
const phoneBell = (page: Page) => page.locator('.app-topbar').getByRole('link', { name: /Notificaciones/ })
const articleTitled = (page: Page, title: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) })

function memberWithTwoNotifications() {
  const api = new FakeNotificationsApi([sofia, tomas])
  api.add(sofia.id, 'Aviso anterior', { readAt: '2026-10-01T13:00:00.000Z', type: 'GENERAL' })
  api.add(sofia.id, 'Apto aprobado', { type: 'MEDICAL_CERTIFICATE_REVIEWED' })
  api.add(sofia.id, 'Aumento de cuota', { type: 'MEMBERSHIP_PRICE_CHANGED' })
  api.add(tomas.id, 'Clase asignada', { type: 'CLASS_CHANGED', message: 'Se te asignó la clase de Yoga.' })
  return api
}

test.describe('[API simulada] bandeja de notificaciones (escritorio)', () => {
  test('el socio consulta sus notificaciones, marca una como leída y el estado persiste al recargar', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await api.install(page)
    await login(page, sofia)

    await expect(menuEntry(page)).toContainText('2 notificaciones sin leer')
    await menuEntry(page).click()
    await expect(page).toHaveURL(/\/socio\/notificaciones$/)
    await expect(page.getByRole('heading', { name: 'Notificaciones' })).toBeVisible()

    const newest = articleTitled(page, 'Aumento de cuota')
    const unread = articleTitled(page, 'Apto aprobado')
    const read = articleTitled(page, 'Aviso anterior')
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(newest).toContainText('No leída')
    await expect(unread).toContainText('No leída')
    await expect(read).toContainText('Leída')
    // Newest first, and the private notification of the trainer never shows up.
    await expect(page.getByRole('article').first()).toContainText('Aumento de cuota')
    await expect(page.getByText('Clase asignada')).toHaveCount(0)

    const unfilteredQuery = api.listRequests.find(({ query }) => !query.has('isRead'))?.query
    expect(unfilteredQuery?.get('page')).toBe('1')
    expect(unfilteredQuery?.get('limit')).toBe('20')

    await unread.getByRole('button', { name: 'Marcar como leída' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Notificación marcada como leída.' })).toBeVisible()
    await expect(unread).toContainText('Leída')
    await expect(unread.getByRole('button', { name: 'Marcar como leída' })).toHaveCount(0)
    await expect(menuEntry(page)).toContainText('1 notificación sin leer')
    expect(api.unreadOf(sofia.id)).toBe(1)

    await page.reload()
    await expect(articleTitled(page, 'Apto aprobado')).toContainText('Leída')
    await expect(articleTitled(page, 'Aumento de cuota')).toContainText('No leída')
    await expect(menuEntry(page)).toContainText('1 notificación sin leer')
  })

  test('abrir un aviso lo marca como leído y muestra su detalle; el control explícito sigue disponible y el teclado alcanza', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await api.install(page)
    await login(page, sofia)
    await menuEntry(page).click()

    const unread = articleTitled(page, 'Apto aprobado')
    const other = articleTitled(page, 'Aumento de cuota')
    await expect(unread.getByRole('button', { name: 'Marcar como leída' })).toBeVisible()
    await unread.getByRole('button', { name: 'Ver detalle' }).click()
    await expect(unread.getByRole('button', { name: 'Ocultar detalle' })).toHaveAttribute('aria-expanded', 'true')
    await expect(unread).toContainText('Leída')
    await expect(unread.locator('dl')).toContainText(/Leída el \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
    await expect(unread.getByRole('button', { name: 'Marcar como leída' })).toHaveCount(0)
    await expect(menuEntry(page)).toContainText('1 notificación sin leer')
    expect(api.unreadOf(sofia.id)).toBe(1)

    // Keyboard: the control is reachable and Enter opens (and reads) the other one; only one detail stays open.
    await other.getByRole('button', { name: 'Ver detalle' }).focus()
    await page.keyboard.press('Enter')
    await expect(other).toContainText('Leída')
    await expect(other.getByRole('button', { name: 'Ocultar detalle' })).toBeFocused()
    await expect(unread.locator('dl')).toHaveCount(0)
    expect(api.unreadOf(sofia.id)).toBe(0)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)

    await page.reload()
    await expect(articleTitled(page, 'Apto aprobado')).toContainText('Leída')
    await expect(articleTitled(page, 'Aumento de cuota')).toContainText('Leída')
  })

  test('marca todas como leídas, deshabilita el botón, quita el contador y conserva el historial', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await api.install(page)
    await login(page, sofia)
    await menuEntry(page).click()

    const markAll = page.getByRole('button', { name: 'Marcar todas como leídas' })
    await expect(markAll).toBeEnabled()
    await markAll.click()

    await expect(page.getByRole('status').filter({ hasText: 'Todas las notificaciones se marcaron como leídas.' })).toBeVisible()
    await expect(markAll).toBeDisabled()
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)
    expect(api.unreadOf(sofia.id)).toBe(0)

    await page.reload()
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
  })

  test('pagina sin perder avisos y permite marcar todas aunque las no leídas estén en otras páginas', async ({ page }) => {
    const api = new FakeNotificationsApi([sofia, tomas])
    for (let index = 0; index < 25; index += 1) api.add(sofia.id, `Antigua ${String(index).padStart(2, '0')}`)
    for (let index = 0; index < 20; index += 1) api.add(sofia.id, `Reciente ${String(index).padStart(2, '0')}`, { readAt: '2026-10-02T00:00:00.000Z' })
    await api.install(page)
    await login(page, sofia)
    await expect(menuEntry(page)).toContainText('25 notificaciones sin leer')
    await menuEntry(page).click()

    await expect(page.getByText('Página 1 de 3')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(20)
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    // Everything on this page is already read, yet there are 25 unread notices in the next ones.
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeEnabled()

    const seen = new Set<string>()
    for (const label of ['Página 1 de 3', 'Página 2 de 3', 'Página 3 de 3']) {
      await expect(page.getByText(label)).toBeVisible()
      for (const heading of await page.getByRole('article').getByRole('heading').allTextContents()) seen.add(heading)
      if (label !== 'Página 3 de 3') await page.getByRole('button', { name: 'Siguiente' }).click()
    }
    expect(seen.size).toBe(45)
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled()

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Todas las notificaciones se marcaron como leídas.' })).toBeVisible()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)
    expect(api.unreadOf(sofia.id)).toBe(0)
  })

  test('muestra el error de carga y se recupera al reintentar; lo mismo al guardar la lectura', async ({ page }) => {
    const api = memberWithTwoNotifications()
    api.failNextUnfilteredList = 1
    await api.install(page)
    await login(page, sofia)
    await menuEntry(page).click()

    await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los datos' })).toBeVisible()
    await page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los datos' }).getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('article')).toHaveCount(3)

    api.failNextReadStatus = 1
    await articleTitled(page, 'Apto aprobado').getByRole('button', { name: 'Marcar como leída' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudo guardar el estado de lectura. Intentá nuevamente.' })).toBeVisible()
    await expect(page.getByText('Notificación marcada como leída.')).toHaveCount(0)
    await expect(articleTitled(page, 'Apto aprobado')).toContainText('No leída')

    await page.getByRole('alert').getByRole('button', { name: 'Reintentar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Notificación marcada como leída.' })).toBeVisible()
    await expect(articleTitled(page, 'Apto aprobado')).toContainText('Leída')
  })

  test('recibe un aviso nuevo con la aplicación abierta y vuelve al ingreso si la sesión vence', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await page.clock.install()
    await api.install(page)
    await login(page, sofia)
    await menuEntry(page).click()
    await expect(page.getByRole('article')).toHaveCount(3)
    await expect(menuEntry(page)).toContainText('2 notificaciones sin leer')

    api.add(sofia.id, 'Evento cancelado', { type: 'EVENT_CANCELLED', message: 'Se canceló el evento "Torneo".' })
    await page.clock.fastForward(61_000)

    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(page.getByRole('article').first()).toContainText('Evento cancelado')
    await expect(menuEntry(page)).toContainText('3 notificaciones sin leer')

    api.revoke(sofia.id)
    await page.clock.fastForward(61_000)
    await expect(page).toHaveURL(/\/iniciar-sesion$/)
    await expect(page.getByText('Evento cancelado')).toHaveCount(0)
  })

  test('cada sesión ve solo sus avisos y al cerrar sesión no queda nada de la cuenta anterior', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await api.install(page)

    await login(page, sofia)
    await menuEntry(page).click()
    await expect(articleTitled(page, 'Apto aprobado')).toBeVisible()
    await expect(menuEntry(page)).toContainText('2 notificaciones sin leer')

    await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
    await expect(page).toHaveURL(/\/iniciar-sesion$/)
    await page.goto('/socio/notificaciones')
    await expect(page).toHaveURL(/\/iniciar-sesion$/)
    await expect(page.getByText('Apto aprobado')).toHaveCount(0)

    await login(page, tomas)
    await expect(menuEntry(page)).toContainText('1 notificación sin leer')
    await menuEntry(page).click()
    await expect(page).toHaveURL(/\/entrenador\/notificaciones$/)
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(articleTitled(page, 'Clase asignada')).toContainText('Se te asignó la clase de Yoga.')
    await expect(page.getByText('Apto aprobado')).toHaveCount(0)
    await expect(page.getByText('Aumento de cuota')).toHaveCount(0)

    // The previous account's token is not reused: asking for its page now shows the trainer's own inbox only.
    expect(api.listRequests.filter(({ userId }) => userId === tomas.id).length).toBeGreaterThan(0)
  })
})

test.describe('[API simulada] bandeja de notificaciones (celular)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('se llega desde la campana de la barra superior, se lee y se marca sin desbordes', async ({ page }) => {
    const api = memberWithTwoNotifications()
    await api.install(page)
    await login(page, sofia)

    await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden()
    const tabs = page.getByRole('navigation', { name: 'Navegación inferior' })
    await expect(tabs).toBeVisible()
    await expect(tabs.getByRole('link', { name: /Notificaciones/ })).toHaveCount(0)

    await expect(phoneBell(page)).toBeVisible()
    await expect(phoneBell(page)).toContainText('2 notificaciones sin leer')
    await phoneBell(page).click()
    await expect(page).toHaveURL(/\/socio\/notificaciones$/)
    await expect(page.locator('.app-topbar-title')).toHaveText('Notificaciones')
    await expect(phoneBell(page)).toHaveAttribute('aria-current', 'page')

    await expect(page.getByRole('article')).toHaveCount(3)
    const pageIsNotWiderThanThePhone = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(pageIsNotWiderThanThePhone).toBe(true)
    for (const box of await page.getByRole('article').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().right))) {
      expect(box).toBeLessThanOrEqual(390)
    }

    await articleTitled(page, 'Apto aprobado').getByRole('button', { name: 'Marcar como leída' }).tap()
    await expect(articleTitled(page, 'Apto aprobado')).toContainText('Leída')
    await expect(phoneBell(page)).toContainText('1 notificación sin leer')

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).tap()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.locator('.app-topbar .app-nav-badge')).toHaveCount(0)
  })

  test('al marcar un aviso como leído la lista no se reconstruye: conserva la posición y el foco', async ({ page }) => {
    const api = new FakeNotificationsApi([sofia, tomas])
    for (let index = 1; index <= 20; index += 1) api.add(sofia.id, `Aviso ${String(index).padStart(2, '0')}`)
    await api.install(page)
    await login(page, sofia)
    await phoneBell(page).click()
    await expect(page.getByRole('article')).toHaveCount(20)

    const target = articleTitled(page, 'Aviso 01') // the oldest one is the last card: the page is scrolled down to reach it
    await target.scrollIntoViewIfNeeded()
    const node = await target.elementHandle()
    const topBefore = await target.evaluate((element) => element.getBoundingClientRect().top)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)

    await target.getByRole('button', { name: 'Marcar como leída' }).tap()
    await expect(target).toContainText('Leída')
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true)
    expect(Math.abs((await target.evaluate((element) => element.getBoundingClientRect().top)) - topBefore)).toBeLessThan(80)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
    await expect(target.getByRole('button', { name: 'Ver detalle' })).toBeFocused()
    await expect(phoneBell(page)).toContainText('19 notificaciones sin leer')
  })
})
