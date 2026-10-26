import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { openDatabaseProbe, openDatabaseWriter, type DatabaseProbe } from '../support/postgres-probe'

/**
 * [BACKEND Y POSTGRESQL REALES] Nothing in this file is mocked: the browser talks to the real Express API,
 * which reads and writes a disposable local PostgreSQL database. Business events are triggered by the
 * administrator (through the API or the administration screens), and what the screens stored is checked
 * with direct SQL. The tests with a simulated API live in e2e/notifications.spec.ts.
 *
 * Prerequisites (see frontend/README.md): backend running on a local test database, seeded with
 * `npm run seed:e2e:notifications -- --out <file>`, and these variables:
 *   E2E_REAL_API_URL  e.g. http://127.0.0.1:3100/api   (the backend must allow the origin http://127.0.0.1:4173)
 *   E2E_REAL_FIXTURE  the file written by the seed script
 * The tests run in order and share the database state; run the seed again before repeating them.
 */
const apiUrl = process.env.E2E_REAL_API_URL
const fixturePath = process.env.E2E_REAL_FIXTURE
const APP_URL = 'http://127.0.0.1:4173'
const GYM_TIME_ZONE = 'America/Argentina/Buenos_Aires'

interface Fixture {
  password: string
  admin: { id: string; email: string }
  member: { id: string; email: string }
  otherMember: { id: string; email: string }
  trainer: { id: string; email: string }
  branch: { id: string; name: string }
  certificateId: string
  backendDir: string
  databaseUrl: string
}

interface Notice { id: string; type: string; title: string; message: string; readAt: string | null }

type Account = 'admin' | 'member' | 'otherMember' | 'trainer'

function mondayOnOrAfter(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

/** "03/03/2092 a las 23:30": an independent oracle for the Buenos Aires wording of the texts. */
function gymDateTime(instant: Date) {
  const date = new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }).format(instant)
  const time = new Intl.DateTimeFormat('es-AR', { timeZone: GYM_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  return `${date} a las ${time}`
}

/** "03/03/2092 23:30": how the screens write a date and time, built with another locale and API as an independent oracle. */
function uiDateTime(instant: Date) {
  const [date, time] = instant.toLocaleString('sv-SE', { timeZone: GYM_TIME_ZONE, hour12: false }).split(' ')
  const [year, month, day] = date!.split('-')
  return `${day}/${month}/${year} ${time!.slice(0, 5)}`
}

const menuEntry = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: /Notificaciones/ })
const phoneBell = (page: Page) => page.locator('.app-topbar').getByRole('link', { name: /Notificaciones/ })
const inbox = (page: Page) => page.locator('.notification-list')
const articleTitled = (page: Page, title: string | RegExp) => page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) })
const unreadLabel = (count: number) => (count === 1 ? '1 notificación sin leer' : `${count} notificaciones sin leer`)

async function loginThroughTheUi(page: Page, email: string, password: string) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByPlaceholder('Ingresá tu contraseña').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page).not.toHaveURL(/iniciar-sesion/)
}

async function logoutThroughTheUi(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click()
  await expect(page).toHaveURL(/iniciar-sesion/)
}

test.describe('[backend y PostgreSQL reales] notificaciones', () => {
  test.skip(!apiUrl || !fixturePath, 'Define E2E_REAL_API_URL y E2E_REAL_FIXTURE para ejecutar la verificación real (ver README).')
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120_000)

  let fixture: Fixture
  let api: APIRequestContext
  let db: DatabaseProbe
  let writer: DatabaseProbe
  let eventTitle: string
  const tokens: Record<Account, string> = { admin: '', member: '', otherMember: '', trainer: '' }

  async function send(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, token: string, data?: unknown) {
    return api.fetch(`${apiUrl}${path}`, { method, headers: { Authorization: `Bearer ${token}` }, data })
  }

  async function createdByAdmin(path: string, data: unknown) {
    const headers = path === '/membership-prices'
      ? { Authorization: `Bearer ${tokens.admin}`, 'Idempotency-Key': randomUUID() }
      : { Authorization: `Bearer ${tokens.admin}` }
    const response = await api.fetch(`${apiUrl}${path}`, { method: 'POST', headers, data })
    expect(response.status(), `${path}: ${await response.text()}`).toBe(201)
    return response.json()
  }

  async function inboxOf(token: string, page = 1): Promise<{ items: Notice[]; total: number; unreadCount: number }> {
    const response = await send('GET', `/notifications?page=${page}&limit=100`, token)
    expect(response.status()).toBe(200)
    return response.json()
  }

  async function login(email: string): Promise<string> {
    const response = await api.post(`${apiUrl}/auth/login`, { data: { email, password: fixture.password } })
    expect(response.status(), `login de ${email}`).toBe(200)
    return (await response.json()).accessToken
  }

  const userId = (account: Exclude<Account, 'admin'>) => fixture[account].id
  async function unreadInDatabase(id: string) {
    const [row] = await db.rows<{ n: number }>('SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND read_at IS NULL', [id])
    return row?.n ?? -1
  }
  async function countInDatabase(id: string, type: string) {
    const [row] = await db.rows<{ n: number }>('SELECT count(*)::int AS n FROM notification WHERE user_id = $1 AND type = $2::"NotificationType"', [id, type])
    return row?.n ?? -1
  }
  async function readAtInDatabase(id: string, title: string) {
    const rows = await db.rows<{ read_at: Date | null }>('SELECT read_at FROM notification WHERE user_id = $1 AND title = $2', [id, title])
    expect(rows, `fila de "${title}"`).toHaveLength(1)
    return rows[0]!.read_at
  }

  /** A second browser session, as another person at another computer would have. */
  async function openSessionOf(browser: Browser, account: Account) {
    const context = await browser.newContext({ baseURL: APP_URL })
    const page = await context.newPage()
    await loginThroughTheUi(page, fixture[account].email, fixture.password)
    return { context, page }
  }

  test.beforeAll(async () => {
    fixture = JSON.parse(readFileSync(fixturePath!, 'utf8')) as Fixture
    if (!fixture.backendDir || !fixture.databaseUrl) {
      throw new Error('El archivo de fixture es de una versión anterior del seed (falta backendDir o databaseUrl): volvé a generarlo con `npm run seed:e2e:notifications`.')
    }
    api = await playwrightRequest.newContext()
    db = await openDatabaseProbe({ backendDir: fixture.backendDir, databaseUrl: fixture.databaseUrl })
    writer = await openDatabaseWriter({ backendDir: fixture.backendDir, databaseUrl: fixture.databaseUrl })
    for (const account of ['admin', 'member', 'otherMember', 'trainer'] as const) tokens[account] = await login(fixture[account].email)

    // The administrator drives real business events through the real API.
    await createdByAdmin('/membership-prices', { amount: 10000, effectiveFrom: '2092-01-01T03:00:00.000Z' })
    await createdByAdmin('/membership-prices', { amount: 12500.5, effectiveFrom: '2092-06-01T02:30:00.000Z' }) // 31/05/2092 23:30 in Buenos Aires
    await createdByAdmin('/membership-prices', { amount: 12500.5, effectiveFrom: '2092-07-01T03:00:00.000Z' }) // not an increase: no notice

    eventTitle = `Torneo E2E ${Date.now()}`
    const eventData = { title: eventTitle, description: 'Evento de la prueba E2E', startsAt: '2092-03-04T02:30:00.000Z', location: 'Sede E2E', imageUrl: 'https://example.test/e2e.png' }
    const published = await createdByAdmin('/events', { ...eventData, status: 'PUBLISHED' })
    expect((await send('PATCH', `/events/${published.id}/status`, tokens.admin, { status: 'CANCELLED' })).status()).toBe(200)
    const draft = await createdByAdmin('/events', { ...eventData, title: `${eventTitle} (borrador)` })
    expect((await send('PATCH', `/events/${draft.id}/status`, tokens.admin, { status: 'CANCELLED' })).status()).toBe(200)
  })

  test.afterAll(async () => {
    await db?.close()
    await writer?.close()
    await api?.dispose()
  })

  test('caso 1 y 2: el socio ve sus avisos reales, marca uno como leído y read_at cambia en PostgreSQL y persiste al recargar', async ({ page }) => {
    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await expect(page).toHaveURL(/\/socio$/)
    await expect(menuEntry(page)).toContainText(unreadLabel(3))
    await menuEntry(page).click()
    await expect(page).toHaveURL(/\/socio\/notificaciones$/)

    const articles = page.getByRole('article')
    await expect(articles).toHaveCount(3)
    await expect(articles.nth(0)).toContainText('Cuota próxima a vencer')
    await expect(articles.nth(1)).toContainText('Evento cancelado')
    await expect(articles.nth(2)).toContainText('Aumento de cuota')
    await expect(articles.nth(0)).toContainText(/Tu cuota vence el \d{2}\/\d{2}\/\d{4} a las \d{2}:\d{2}\./)
    await expect(articles.nth(1)).toContainText(`Se canceló el evento "${eventTitle}" previsto para el 03/03/2092 a las 23:30.`)
    await expect(articles.nth(2)).toContainText('La cuota mensual pasa a ser de $ 12.500,50 desde el 31/05/2092.')
    await expect(page.locator('article.is-unread')).toHaveCount(3)

    // The screen and the database agree before reading anything.
    expect(await unreadInDatabase(userId('member'))).toBe(3)
    expect(await readAtInDatabase(userId('member'), 'Evento cancelado')).toBeNull()
    const otherUnreadBefore = await unreadInDatabase(userId('otherMember'))

    await articleTitled(page, 'Evento cancelado').getByRole('button', { name: 'Marcar como leída' }).click()
    await expect(articleTitled(page, 'Evento cancelado')).toContainText('Leída')
    await expect(menuEntry(page)).toContainText(unreadLabel(2))

    const readAt = await readAtInDatabase(userId('member'), 'Evento cancelado')
    expect(readAt).toBeInstanceOf(Date)
    expect(await unreadInDatabase(userId('member'))).toBe(2)

    await page.reload()
    await expect(articleTitled(page, 'Evento cancelado')).toContainText('Leída')
    await expect(page.locator('article.is-unread')).toHaveCount(2)
    await expect(menuEntry(page)).toContainText(unreadLabel(2))
    expect(await readAtInDatabase(userId('member'), 'Evento cancelado')).toEqual(readAt)
    expect(await unreadInDatabase(userId('otherMember'))).toBe(otherUnreadBefore)
  })

  test('caso 3: con varias páginas, "marcar todas" actualiza todas las no leídas del usuario y no las de otro', async ({ page }) => {
    // 25 more real price increases: every active member gets 25 more notices.
    for (let index = 0; index < 25; index += 1) {
      const day = String(index + 1).padStart(2, '0')
      await createdByAdmin('/membership-prices', { amount: 12501 + index, effectiveFrom: `2093-01-${day}T03:00:00.000Z` })
    }
    const memberUnread = await unreadInDatabase(userId('member'))
    const otherUnread = await unreadInDatabase(userId('otherMember'))
    expect(memberUnread).toBe(27)

    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await expect(menuEntry(page)).toContainText(unreadLabel(memberUnread))
    await menuEntry(page).click()
    await expect(page.getByText('Página 1 de 2')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.getByText('Página 2 de 2')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(8)
    await page.getByRole('button', { name: 'Anterior' }).click()

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Todas las notificaciones se marcaron como leídas.' })).toBeVisible()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)

    expect(await unreadInDatabase(userId('member'))).toBe(0)
    expect(await unreadInDatabase(userId('otherMember'))).toBe(otherUnread)
    await page.reload()
    await page.getByRole('button', { name: 'Siguiente' }).click()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
  })

  test('caso 4 y 7: el socio recibe sin cerrar sesión el evento que el administrador cancela desde su pantalla', async ({ browser, page }) => {
    const startsAt = new Date(Date.now() + 7 * 86_400_000)
    const title = `Evento en vivo ${Date.now()}`
    const published = await createdByAdmin('/events', { title, description: 'Evento de la prueba E2E', startsAt: startsAt.toISOString(), location: 'Sede E2E', imageUrl: 'https://example.test/e2e.png', status: 'PUBLISHED' })

    // The member keeps the inbox open; the timers of this page are driven by the test.
    await page.clock.install()
    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    await expect(page.getByRole('article')).toHaveCount(20)
    await expect(page.locator('.app-nav-badge')).toHaveCount(0)

    // Another person, in another browser session, cancels the published event from the administration screen.
    const admin = await openSessionOf(browser, 'admin')
    try {
      await admin.page.goto('/admin/eventos')
      const card = admin.page.getByRole('article').filter({ has: admin.page.getByRole('heading', { name: title }) })
      admin.page.once('dialog', (dialog) => void dialog.accept())
      await card.getByRole('button', { name: 'Cancelar evento' }).click()
      await expect(card.getByRole('button', { name: 'Cancelar evento' })).toHaveCount(0)
    } finally {
      await admin.context.close()
    }

    await page.clock.fastForward(61_000)
    const arrived = articleTitled(page, 'Evento cancelado').first()
    await expect(arrived).toContainText(`Se canceló el evento "${title}" previsto para el ${gymDateTime(startsAt)}.`)
    await expect(arrived).toContainText('No leída')
    await expect(page.getByRole('article').first()).toContainText(title)
    await expect(menuEntry(page)).toContainText(unreadLabel(1))

    // One notice per active member and trainer, none for the administrator, none repeated.
    for (const account of ['member', 'otherMember', 'trainer'] as const) {
      const rows = await db.rows<{ dedupe_key: string }>('SELECT dedupe_key FROM notification WHERE user_id = $1 AND dedupe_key LIKE $2', [userId(account), `event-cancelled:${published.id}:%`])
      expect(rows.map((row) => row.dedupe_key), account).toEqual([`event-cancelled:${published.id}:${userId(account)}`])
    }
    expect(await db.rows('SELECT 1 FROM notification WHERE user_id = $1 AND dedupe_key LIKE $2', [fixture.admin.id, 'event-cancelled:%'])).toHaveLength(0)
    expect(await db.rows('SELECT 1 FROM event WHERE id = $1 AND status = \'CANCELLED\'', [published.id])).toHaveLength(1)
  })

  test('caso 5: el administrador rechaza el apto desde su pantalla y solo el socio dueño recibe el aviso', async ({ browser, page }) => {
    const admin = await openSessionOf(browser, 'admin')
    try {
      await admin.page.goto(`/admin/aptos/${fixture.certificateId}`)
      await admin.page.getByLabel('Observación para el socio').fill('Falta la firma del profesional.')
      await admin.page.getByRole('button', { name: 'Rechazar apto médico' }).click()
      await expect.poll(() => countInDatabase(userId('member'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(1)
    } finally {
      await admin.context.close()
    }

    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    const notice = articleTitled(page, 'Apto médico rechazado')
    await expect(notice).toContainText('Tu apto médico fue rechazado. Observación: Falta la firma del profesional.')
    await expect(notice).toContainText('No leída')

    expect(await countInDatabase(userId('otherMember'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(0)
    expect(await countInDatabase(userId('trainer'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(0)
    const [certificate] = await db.rows<{ status: string; review_comment: string; reviewed_by_id: string; reviewed_at: Date }>(
      'SELECT status, review_comment, reviewed_by_id, reviewed_at FROM medical_certificate WHERE id = $1',
      [fixture.certificateId],
    )
    expect(certificate).toMatchObject({ status: 'REJECTED', review_comment: 'Falta la firma del profesional.', reviewed_by_id: fixture.admin.id })
    expect(certificate?.reviewed_at).toBeInstanceOf(Date)
  })

  test('caso 5 bis: el administrador cambia el valor de la cuota desde su pantalla y cada socio activo recibe el aviso', async ({ browser, page }) => {
    const before = { member: await countInDatabase(userId('member'), 'MEMBERSHIP_PRICE_CHANGED'), other: await countInDatabase(userId('otherMember'), 'MEMBERSHIP_PRICE_CHANGED') }

    const admin = await openSessionOf(browser, 'admin')
    try {
      await admin.page.goto('/admin/pagos')
      // The UI explains that PostgreSQL determines the recipient set at commit time, avoiding a stale client-side count.
      await expect(admin.page.getByText(/Solo los aumentos notifican a los socios activos/)).toBeVisible()
      await admin.page.getByLabel('Nuevo valor').fill('13000.75')
      await admin.page.getByLabel('Vigente desde').fill('2094-01-01')
      await admin.page.getByRole('button', { name: 'Guardar nuevo valor' }).click()
      // The price card does not keep its own confirmation (the whole screen reloads), so the outcome is checked in the database.
      await expect.poll(() => countInDatabase(userId('member'), 'MEMBERSHIP_PRICE_CHANGED')).toBe(before.member + 1)
    } finally {
      await admin.context.close()
    }

    expect(await countInDatabase(userId('member'), 'MEMBERSHIP_PRICE_CHANGED')).toBe(before.member + 1)
    expect(await countInDatabase(userId('otherMember'), 'MEMBERSHIP_PRICE_CHANGED')).toBe(before.other + 1)
    expect(await countInDatabase(userId('trainer'), 'MEMBERSHIP_PRICE_CHANGED')).toBe(0)
    const [persistedPrice] = await db.rows<{ amount: string; effective_from: Date }>(
      'SELECT amount::text AS amount, effective_from FROM membership_price WHERE created_by_id = $1 ORDER BY effective_from DESC, created_at DESC LIMIT 1',
      [fixture.admin.id],
    )
    expect(persistedPrice?.amount).toBe('13000.75')
    expect(persistedPrice?.effective_from).toEqual(new Date('2094-01-01T03:00:00.000Z'))

    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    await expect(page.getByRole('article').first()).toContainText('La cuota mensual pasa a ser de $ 13.000,75 desde el 01/01/2094.')
  })

  test('caso 6: el entrenador recibe las altas, el cambio y la baja de sus clases con los datos correctos', async ({ page }) => {
    const monday = mondayOnOrAfter('2092-03-01')
    const at = (days: number, hoursUtc: number) => new Date(monday.getTime() + days * 86_400_000 + hoursUtc * 3_600_000)
    const classData = { weekStartsOn: monday.toISOString().slice(0, 10), activity: 'Yoga', startsAt: at(1, 15).toISOString(), branchId: fixture.branch.id, trainerId: fixture.trainer.id }
    const yoga = await createdByAdmin('/scheduled-classes', classData)
    const [createdClass] = await db.rows<{ activity: string; branch_id: string; trainer_id: string; starts_at: Date; week_starts_on: string }>(
      'SELECT sc.activity, sc.branch_id, sc.trainer_id, sc.starts_at, ws.week_starts_on::text AS week_starts_on FROM scheduled_class sc JOIN weekly_schedule ws ON ws.id = sc.schedule_id WHERE sc.id = $1',
      [yoga.id],
    )
    expect(createdClass).toMatchObject({ activity: 'Yoga', branch_id: fixture.branch.id, trainer_id: fixture.trainer.id, starts_at: at(1, 15), week_starts_on: monday.toISOString().slice(0, 10) })
    expect((await send('PATCH', `/scheduled-classes/${yoga.id}`, tokens.admin, { startsAt: at(2, 13).toISOString() })).status()).toBe(200)
    const [updatedClass] = await db.rows<{ starts_at: Date }>('SELECT starts_at FROM scheduled_class WHERE id = $1', [yoga.id])
    expect(updatedClass?.starts_at).toEqual(at(2, 13))
    const pilates = await createdByAdmin('/scheduled-classes', { ...classData, activity: 'Pilates' })
    expect((await send('DELETE', `/scheduled-classes/${pilates.id}`, tokens.admin)).status()).toBe(204)
    expect(await db.rows('SELECT id FROM scheduled_class WHERE id = $1', [pilates.id])).toHaveLength(0)

    const unread = await unreadInDatabase(userId('trainer'))
    await loginThroughTheUi(page, fixture.trainer.email, fixture.password)
    await expect(page).toHaveURL(/\/entrenador$/)
    await expect(menuEntry(page)).toContainText(unreadLabel(unread))
    await menuEntry(page).click()

    await expect(articleTitled(page, 'Clase asignada')).toHaveCount(2)
    await expect(articleTitled(page, 'Clase asignada').first()).toContainText(`en ${fixture.branch.name}.`)
    await expect(articleTitled(page, 'Clase modificada')).toContainText(`Se modificó la clase de Yoga: el horario cambió del ${gymDateTime(at(1, 15))} al ${gymDateTime(at(2, 13))}.`)
    await expect(articleTitled(page, 'Clase cancelada')).toContainText(`Se canceló la clase de Pilates del ${gymDateTime(at(1, 15))} en ${fixture.branch.name}.`)
    await expect(articleTitled(page, 'Evento cancelado')).toHaveCount(2)
    await expect(inbox(page).getByText(/Cuota|Apto médico/)).toHaveCount(0)
    expect(await countInDatabase(userId('trainer'), 'CLASS_CHANGED')).toBe(4)

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click()
    await expect(page.locator('article.is-unread')).toHaveCount(0)
    expect(await unreadInDatabase(userId('trainer'))).toBe(0)
  })

  test('caso 8: otro socio solo ve lo suyo y ninguna cuenta puede leer ni marcar los avisos ajenos', async ({ page }) => {
    await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
    await menuEntry(page).click()
    await expect(page.getByRole('article').first()).toBeVisible()

    const own = await inboxOf(tokens.otherMember)
    const titles = new Set(own.items.map((item) => item.title))
    expect([...titles].sort()).toEqual(['Aumento de cuota', 'Cuota vencida', 'Evento cancelado'])
    for (const privateTitle of ['Apto médico rechazado', 'Cuota próxima a vencer', 'Clase asignada']) {
      await expect(inbox(page).getByText(privateTitle)).toHaveCount(0)
    }

    const [memberPrivate] = await db.rows<{ id: string }>('SELECT id FROM notification WHERE user_id = $1 AND title = $2', [userId('member'), 'Apto médico rechazado'])
    const [trainerPrivate] = await db.rows<{ id: string }>('SELECT id FROM notification WHERE user_id = $1 AND title = $2', [userId('trainer'), 'Clase cancelada'])
    const readAtBefore = await readAtInDatabase(userId('member'), 'Apto médico rechazado')
    expect(readAtBefore).toBeNull()
    for (const [account, privateId] of [['otherMember', memberPrivate!.id], ['admin', memberPrivate!.id], ['trainer', memberPrivate!.id], ['otherMember', trainerPrivate!.id]] as const) {
      expect((await send('GET', `/notifications/${privateId}`, tokens[account])).status(), `${account} lee ${privateId}`).toBe(404)
      expect((await send('PATCH', `/notifications/${privateId}/read-status`, tokens[account])).status(), `${account} marca ${privateId}`).toBe(404)
    }
    expect((await send('GET', `/notifications?userId=${fixture.member.id}`, tokens.otherMember)).status()).toBe(400)
    expect(await readAtInDatabase(userId('member'), 'Apto médico rechazado')).toBeNull()
    expect((await api.get(`${apiUrl}/notifications`)).status()).toBe(401)
  })

  test('caso 9: al cerrar sesión y entrar con otra cuenta no queda nada del usuario anterior', async ({ page }) => {
    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    await expect(articleTitled(page, 'Apto médico rechazado')).toBeVisible()
    await expect(menuEntry(page)).toContainText(/notificaci/)

    await logoutThroughTheUi(page)
    await page.goBack()
    await expect(page).toHaveURL(/iniciar-sesion/)
    await expect(page.getByText('Apto médico rechazado')).toHaveCount(0)

    await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
    await expect(page).toHaveURL(/\/socio$/)
    await menuEntry(page).click()
    await expect(page.getByRole('article').first()).toBeVisible()
    await expect(page.getByText('Apto médico rechazado')).toHaveCount(0)
    await expect(page.getByText('Cuota próxima a vencer')).toHaveCount(0)
    const unread = await unreadInDatabase(userId('otherMember'))
    if (unread > 0) await expect(menuEntry(page)).toContainText(unreadLabel(unread))
    else await expect(page.locator('.app-nav-badge')).toHaveCount(0)

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(stored).not.toContain('Apto médico rechazado')
    expect(stored).not.toContain('Aumento de cuota')
  })

  test.describe('en el celular', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

    test('caso 10: campana con contador, listado paginado, carga, error con reintento y lectura sin desbordes', async ({ page }) => {
      const isInboxList = (url: string) => url.includes('/notifications?') && !url.includes('isRead=')
      await page.route('**/api/notifications?**', async (route) => {
        if (isInboxList(route.request().url())) await new Promise((resolve) => setTimeout(resolve, 600))
        await route.continue()
      })

      await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
      const unread = await unreadInDatabase(userId('otherMember'))
      expect(unread).toBeGreaterThan(20)
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden()
      await expect(phoneBell(page)).toContainText(unreadLabel(unread))

      await phoneBell(page).click()
      await expect(page).toHaveURL(/\/socio\/notificaciones$/)
      await expect(page.getByText('Cargando notificaciones…')).toBeVisible()
      await expect(page.getByRole('article')).toHaveCount(20)
      await expect(page.getByText(/Página 1 de 2/)).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      for (const right of await page.getByRole('article').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().right))) {
        expect(right).toBeLessThanOrEqual(390)
      }

      // A failed request shows the error and the retry button recovers the list.
      let failures = 1
      await page.unroute('**/api/notifications?**')
      await page.route('**/api/notifications?**', async (route) => {
        if (isInboxList(route.request().url()) && failures > 0) {
          failures -= 1
          await route.abort()
          return
        }
        await route.continue()
      })
      await page.getByRole('button', { name: 'Siguiente' }).tap()
      await expect(page.getByText('No se pudo conectar con el servidor. Revisá tu conexión a internet e intentá nuevamente.')).toBeVisible()
      await page.getByRole('button', { name: 'Reintentar' }).tap()
      await expect(page.getByText(/Página 2 de 2/)).toBeVisible()
      await page.getByRole('button', { name: 'Anterior' }).tap()
      await expect(page.getByRole('article')).toHaveCount(20)

      // Reading from the phone is stored, and the reader keeps their place: the list is not rebuilt, the
      // notification stays where it was on the screen and the keyboard focus stays on it.
      const unreadFlags = await page.getByRole('article').evaluateAll((items) => items.map((item) => item.classList.contains('is-unread')))
      const target = page.getByRole('article').nth(unreadFlags.lastIndexOf(true))
      await target.scrollIntoViewIfNeeded()
      const targetNode = await target.elementHandle()
      const topBefore = await target.evaluate((node) => node.getBoundingClientRect().top)
      await target.getByRole('button', { name: 'Marcar como leída' }).tap()
      await expect(phoneBell(page)).toContainText(unreadLabel(unread - 1))
      expect(await unreadInDatabase(userId('otherMember'))).toBe(unread - 1)
      await expect(target).toContainText('Leída')
      expect(await targetNode!.evaluate((node) => node.isConnected)).toBe(true)
      expect(Math.abs((await target.evaluate((node) => node.getBoundingClientRect().top)) - topBefore)).toBeLessThan(80)
      await expect(target.getByRole('button', { name: 'Ver detalle' })).toBeFocused()

      await page.getByRole('button', { name: 'Marcar todas como leídas' }).tap()
      await expect(page.locator('.app-topbar .app-nav-badge')).toHaveCount(0)
      expect(await unreadInDatabase(userId('otherMember'))).toBe(0)
    })
  })

  test('caso 11: restablecimiento administrativo, cambio obligatorio y vuelta al acceso normal', async ({ browser }) => {
    const admin = await openSessionOf(browser, 'admin')
    let memberContext: Awaited<ReturnType<Browser['newContext']>> | undefined
    try {
      await admin.page.goto(`/admin/usuarios/${fixture.member.id}`)
      await admin.page.getByRole('button', { name: 'Restablecer contraseña' }).click()
      await admin.page.getByRole('button', { name: 'Generar contraseña temporal' }).click()
      const temporaryPassword = await admin.page.getByLabel('Contraseña temporal generada').inputValue()
      expect(temporaryPassword).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const staleSession = await send('GET', '/notifications', tokens.member)
      expect(staleSession.status()).toBe(401)

      const temporaryLogin = await api.post(`${apiUrl}/auth/login`, {
        data: { email: fixture.member.email, password: temporaryPassword },
      })
      expect(temporaryLogin.status()).toBe(200)
      const temporarySession = await temporaryLogin.json()
      expect(temporarySession.user.isPasswordChangeRequired).toBe(true)
      expect((await api.get(`${apiUrl}/notifications`, {
        headers: { Authorization: `Bearer ${temporarySession.accessToken}` },
      })).status()).toBe(403)

      const audit = await send('GET', `/users/${fixture.member.id}/audit-logs?page=1&limit=100`, tokens.admin)
      expect(audit.status()).toBe(200)
      const auditContent = JSON.stringify(await audit.json())
      expect(auditContent).not.toContain(temporaryPassword)

      memberContext = await browser.newContext({ baseURL: APP_URL })
      const memberPage = await memberContext.newPage()
      await loginThroughTheUi(memberPage, fixture.member.email, temporaryPassword)
      await expect(memberPage).toHaveURL(/\/cambiar-contrasena$/)

      // Restore the seeded credential so the following real-backend specs can reuse this fixture.
      const newPassword = fixture.password
      await memberPage.getByLabel('Contraseña actual').fill(temporaryPassword)
      await memberPage.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword)
      await memberPage.getByLabel('Confirmar nueva contraseña').fill(newPassword)
      await memberPage.getByRole('button', { name: 'Guardar contraseña' }).click()
      await expect(memberPage).toHaveURL(/\/socio$/)

      const oldPasswordLogin = await api.post(`${apiUrl}/auth/login`, {
        data: { email: fixture.member.email, password: temporaryPassword },
      })
      expect(oldPasswordLogin.status()).toBe(401)

      const normalLogin = await api.post(`${apiUrl}/auth/login`, {
        data: { email: fixture.member.email, password: newPassword },
      })
      expect(normalLogin.status()).toBe(200)
      const normalSession = await normalLogin.json()
      expect(normalSession.user.isPasswordChangeRequired).toBe(false)
      expect((await api.get(`${apiUrl}/notifications`, {
        headers: { Authorization: `Bearer ${normalSession.accessToken}` },
      })).status()).toBe(200)

      const [account] = await db.rows<{ is_password_change_required: boolean }>(
        'SELECT is_password_change_required FROM "user" WHERE id = $1',
        [fixture.member.id],
      )
      expect(account?.is_password_change_required).toBe(false)
      const notices = await db.rows<{ title: string; message: string }>(
        'SELECT title, message FROM notification WHERE user_id = $1',
        [fixture.member.id],
      )
      expect(JSON.stringify(notices)).not.toContain(temporaryPassword)
      expect(JSON.stringify(notices)).not.toContain(newPassword)
      expect(auditContent).not.toContain(newPassword)
    } finally {
      await memberContext?.close()
      await admin.context.close()
    }
  })

  test('abrir un aviso lo marca como leído, muestra cuándo y persiste en PostgreSQL, con el mouse y con el teclado', async ({ page }) => {
    // Two fresh unread notices for the member: two real increases announced by the administrator.
    await createdByAdmin('/membership-prices', { amount: 99000.25, effectiveFrom: '2097-01-01T03:00:00.000Z' })
    await createdByAdmin('/membership-prices', { amount: 99001.5, effectiveFrom: '2097-02-01T03:00:00.000Z' })
    const unreadBefore = await unreadInDatabase(userId('member'))
    expect(unreadBefore).toBeGreaterThanOrEqual(2)
    const readAtOf = async (amount: string) => {
      const [row] = await db.rows<{ read_at: Date | null }>('SELECT read_at FROM notification WHERE user_id = $1 AND message LIKE $2', [userId('member'), `%${amount} desde%`])
      return row!.read_at
    }

    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    const first = articleTitled(page, 'Aumento de cuota').filter({ hasText: '$ 99.001,50' })
    const second = articleTitled(page, 'Aumento de cuota').filter({ hasText: '$ 99.000,25' })
    await expect(first).toContainText('No leída')
    expect(await readAtOf('99.001,50')).toBeNull()

    // With the mouse: opening reads it and shows when.
    await first.getByRole('button', { name: 'Ver detalle' }).click()
    await expect(first.getByRole('button', { name: 'Ocultar detalle' })).toHaveAttribute('aria-expanded', 'true')
    await expect(first).toContainText('Leída')
    await expect(first.getByRole('button', { name: 'Marcar como leída' })).toHaveCount(0)
    const firstReadAt = await readAtOf('99.001,50')
    expect(firstReadAt).toBeInstanceOf(Date)
    await expect(first.locator('dl')).toContainText(`Leída el ${uiDateTime(firstReadAt!)}`)
    await expect(menuEntry(page)).toContainText(unreadLabel(unreadBefore - 1))

    // With the keyboard: the focus reaches the control and Enter does the same. Only one detail stays open.
    await second.getByRole('button', { name: 'Ver detalle' }).focus()
    await page.keyboard.press('Enter')
    await expect(second).toContainText('Leída')
    await expect(second.getByRole('button', { name: 'Ocultar detalle' })).toBeFocused()
    await expect(first.locator('dl')).toHaveCount(0)
    expect(await unreadInDatabase(userId('member'))).toBe(unreadBefore - 2)

    // Opening something already read changes nothing in the database; closing hides the detail.
    await first.getByRole('button', { name: 'Ver detalle' }).click()
    await expect(first.locator('dl')).toContainText(`Leída el ${uiDateTime(firstReadAt!)}`)
    await first.getByRole('button', { name: 'Ocultar detalle' }).click()
    await expect(first.locator('dl')).toHaveCount(0)
    expect(await readAtOf('99.001,50')).toEqual(firstReadAt)

    await page.reload()
    await expect(articleTitled(page, 'Aumento de cuota').filter({ hasText: '$ 99.001,50' })).toContainText('Leída')
    await expect(articleTitled(page, 'Aumento de cuota').filter({ hasText: '$ 99.000,25' })).toContainText('Leída')
  })

  test('un socio que ya usa la plataforma recibe el aviso al entrar en los 5 días y otro al vencer, sin recargar ni abrir la bandeja', async ({ browser }) => {
    test.setTimeout(180_000)
    const id = userId('otherMember')
    const before = { expiring: await countInDatabase(id, 'MEMBERSHIP_EXPIRING'), expired: await countInDatabase(id, 'MEMBERSHIP_EXPIRED') }

    // A payment accredited 30 days less 25 seconds ago: the fee ends 25 seconds from now, well inside the five-day window.
    const [payment] = await writer.rows<{ expires_at: Date }>(
      `INSERT INTO payment (id, member_id, amount, method, status, created_by_id, confirmed_by_id, accredited_at, expires_at)
       VALUES (gen_random_uuid(), $1, 20000.00, 'CASH', 'ACCREDITED', $2, $2,
               now() - interval '30 days' + interval '25 seconds', now() + interval '25 seconds')
       RETURNING expires_at`,
      [id, fixture.admin.id],
    )
    const expiresAt = payment!.expires_at

    const context = await browser.newContext({ baseURL: APP_URL })
    const page = await context.newPage()
    await page.clock.install() // the timers of this page are driven by the test; the server clock is the real one
    try {
      await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
      await expect(page).toHaveURL(/\/socio$/)

      // Entering the window: the workspace asks the API when it opens, and the notice exists and is counted.
      await expect.poll(() => countInDatabase(id, 'MEMBERSHIP_EXPIRING')).toBe(before.expiring + 1)
      const unreadWithWarning = await unreadInDatabase(id)
      await expect(menuEntry(page)).toContainText(unreadLabel(unreadWithWarning))

      // The fee ends while the member keeps using the app on the same screen.
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now()) + 1_500))
      await page.clock.fastForward(61_000)
      await expect.poll(() => countInDatabase(id, 'MEMBERSHIP_EXPIRED')).toBe(before.expired + 1)
      await expect(menuEntry(page)).toContainText(unreadLabel(unreadWithWarning + 1))
      await expect(page).toHaveURL(/\/socio$/)

      const rows = await db.rows<{ type: string; dedupe_key: string; message: string }>(
        `SELECT type::text AS type, dedupe_key, message FROM notification
          WHERE user_id = $1 AND dedupe_key IN ($2, $3)`,
        [id, `membership-expiring:${id}:${expiresAt.toISOString()}`, `membership-expired:${id}:${expiresAt.toISOString()}`],
      )
      expect(rows.map((row) => row.type).sort()).toEqual(['MEMBERSHIP_EXPIRED', 'MEMBERSHIP_EXPIRING'])
      expect(rows.find((row) => row.type === 'MEMBERSHIP_EXPIRING')?.message).toBe(`Tu cuota vence el ${gymDateTime(expiresAt)}.`)
      expect(rows.find((row) => row.type === 'MEMBERSHIP_EXPIRED')?.message).toContain(`Tu cuota venció el ${gymDateTime(expiresAt)}.`)

      await menuEntry(page).click()
      await expect(articleTitled(page, 'Cuota vencida').first()).toContainText(`Tu cuota venció el ${gymDateTime(expiresAt)}.`)
    } finally {
      await context.close()
    }

    // Another device, another session: it reads the same notices and creates none.
    const otherDevice = await openSessionOf(browser, 'otherMember')
    try {
      await menuEntry(otherDevice.page).click()
      await expect(articleTitled(otherDevice.page, 'Cuota vencida')).toHaveCount(before.expired + 1)
      await expect(articleTitled(otherDevice.page, 'Cuota próxima a vencer')).toHaveCount(before.expiring + 1)
    } finally {
      await otherDevice.context.close()
    }
    expect(await countInDatabase(id, 'MEMBERSHIP_EXPIRING')).toBe(before.expiring + 1)
    expect(await countInDatabase(id, 'MEMBERSHIP_EXPIRED')).toBe(before.expired + 1)
  })

  test('un pago nuevo renueva la vigencia sin avisos nuevos y anularlo no repite lo que ya se avisó', async ({ page }) => {
    const id = userId('otherMember')
    const feeNotices = async () => (await countInDatabase(id, 'MEMBERSHIP_EXPIRING')) + (await countInDatabase(id, 'MEMBERSHIP_EXPIRED'))
    const before = await feeNotices()
    const membershipStatus = async () => (await (await send('GET', '/members/me/membership', tokens.otherMember)).json()).status as string
    expect(await membershipStatus()).toBe('EXPIRED')

    const accredited = await api.fetch(`${apiUrl}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.admin}`, 'Idempotency-Key': randomUUID() },
      data: { memberId: id, amount: 25000, method: 'CASH' },
    })
    expect(accredited.status()).toBe(201)
    const payment = await accredited.json()
    expect(new Date(payment.expiresAt).getTime() - new Date(payment.accreditedAt).getTime()).toBe(30 * 86_400_000)
    expect(await membershipStatus()).toBe('CURRENT')

    // The member opens the app on a current fee: nothing new, and what was announced stays in the history.
    await loginThroughTheUi(page, fixture.otherMember.email, fixture.password)
    await menuEntry(page).click()
    await expect(page.getByRole('article').first()).toBeVisible()
    await expect(articleTitled(page, 'Cuota vencida').first()).toBeVisible()
    expect(await feeNotices()).toBe(before)

    // Voiding it brings back a state that was already announced: it is not announced again.
    const voided = await send('POST', `/payments/${payment.id}/voids`, tokens.admin, { reason: 'Prueba E2E: pago cargado por error' })
    expect(voided.status()).toBe(200)
    expect(await membershipStatus()).toBe('EXPIRED')
    await page.reload()
    await expect(articleTitled(page, 'Cuota vencida').first()).toBeVisible()
    expect(await feeNotices()).toBe(before)
  })

  test('el administrador aprueba un apto nuevo desde su pantalla y solo el socio dueño recibe el aviso, sin perder el historial', async ({ browser, page }) => {
    const [certificate] = await writer.rows<{ id: string }>(
      `INSERT INTO medical_certificate (id, member_id, file_url, status)
       VALUES (gen_random_uuid(), $1, $2, 'PENDING') RETURNING id`,
      [fixture.member.id, `${fixture.member.id}/e2e-approval.pdf`],
    )
    const before = {
      member: await countInDatabase(userId('member'), 'MEDICAL_CERTIFICATE_REVIEWED'),
      otherMember: await countInDatabase(userId('otherMember'), 'MEDICAL_CERTIFICATE_REVIEWED'),
      trainer: await countInDatabase(userId('trainer'), 'MEDICAL_CERTIFICATE_REVIEWED'),
    }

    const admin = await openSessionOf(browser, 'admin')
    try {
      admin.page.on('dialog', (dialog) => void dialog.accept())
      await admin.page.goto(`/admin/aptos/${certificate!.id}`)
      await admin.page.getByRole('button', { name: 'Aprobar apto médico' }).click()
      await expect.poll(() => countInDatabase(userId('member'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(before.member + 1)
    } finally {
      await admin.context.close()
    }

    await loginThroughTheUi(page, fixture.member.email, fixture.password)
    await menuEntry(page).click()
    const approved = articleTitled(page, 'Apto médico aprobado')
    await expect(approved).toContainText('Tu apto médico fue aprobado por un administrador.')
    await expect(approved).toContainText('No leída')
    await expect(articleTitled(page, 'Apto médico rechazado')).toBeVisible() // the earlier rejection stays in the history

    const [persisted] = await db.rows<{ status: string; reviewed_by_id: string; review_comment: string | null; reviewed_at: Date }>(
      'SELECT status, reviewed_by_id, review_comment, reviewed_at FROM medical_certificate WHERE id = $1',
      [certificate!.id],
    )
    expect(persisted).toMatchObject({ status: 'APPROVED', reviewed_by_id: fixture.admin.id, review_comment: null })
    expect(persisted?.reviewed_at).toBeInstanceOf(Date)
    expect(await countInDatabase(userId('otherMember'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(before.otherMember)
    expect(await countInDatabase(userId('trainer'), 'MEDICAL_CERTIFICATE_REVIEWED')).toBe(before.trainer)
    const history = await send('GET', '/members/me/medical-certificates', await login(fixture.member.email))
    expect(history.status()).toBe(200)
    expect((await history.json()).items.map((item: { status: string }) => item.status).sort()).toEqual(['APPROVED', 'REJECTED'])
  })

  test('copiar una semana avisa una vez al entrenador por cada clase aun con tres pedidos simultáneos y no toca la semana de origen', async ({ page }) => {
    const sourceWeek = mondayOnOrAfter('2092-03-01').toISOString().slice(0, 10)
    const destinationWeek = new Date(mondayOnOrAfter('2092-03-01').getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
    const [source] = await db.rows<{ id: string }>('SELECT id FROM weekly_schedule WHERE week_starts_on = $1::date', [sourceWeek])
    const sourceClasses = await db.rows<{ id: string; starts_at: Date }>('SELECT id, starts_at FROM scheduled_class WHERE schedule_id = $1 ORDER BY id', [source!.id])
    expect(sourceClasses.length).toBeGreaterThan(0)
    const before = await countInDatabase(userId('trainer'), 'CLASS_CHANGED')

    const results = await Promise.all([1, 2, 3].map(() => api.fetch(`${apiUrl}/weekly-schedules/${source!.id}/copies`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens.admin}` },
      data: { weekStartsOn: destinationWeek },
    })))
    expect(results.map((response) => response.status()).sort()).toEqual([201, 409, 409])

    expect(await db.rows('SELECT 1 FROM weekly_schedule WHERE week_starts_on = $1::date', [destinationWeek])).toHaveLength(1)
    const copied = await db.rows<{ activity: string; trainer_id: string; starts_at: Date }>(
      `SELECT sc.activity, sc.trainer_id, sc.starts_at FROM scheduled_class sc
         JOIN weekly_schedule ws ON ws.id = sc.schedule_id WHERE ws.week_starts_on = $1::date ORDER BY sc.starts_at`,
      [destinationWeek],
    )
    expect(copied).toHaveLength(sourceClasses.length)
    expect(await db.rows<{ id: string }>('SELECT id FROM scheduled_class WHERE schedule_id = $1 ORDER BY id', [source!.id])).toEqual(sourceClasses.map(({ id }) => ({ id })))
    expect(await countInDatabase(userId('trainer'), 'CLASS_CHANGED')).toBe(before + copied.length)

    await loginThroughTheUi(page, fixture.trainer.email, fixture.password)
    await menuEntry(page).click()
    const newest = page.getByRole('article').first()
    await expect(newest).toContainText('Clase asignada')
    await expect(newest).toContainText(`Se te asignó la clase de ${copied.at(-1)!.activity} el ${gymDateTime(copied.at(-1)!.starts_at)} en ${fixture.branch.name}.`)
  })
})
