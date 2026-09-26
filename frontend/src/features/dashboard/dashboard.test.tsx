import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser, type ApiRoute } from '../../test/test-utils'
import { AdminDashboardScreen } from './AdminDashboardScreen'
import { MemberDashboardScreen } from './MemberDashboardScreen'
import { TrainerDashboardScreen } from './TrainerDashboardScreen'
import { groupRevenueByDay, lastSevenDays } from './dashboard-data'
import adminSource from './AdminDashboardScreen.tsx?raw'
import dataSource from './dashboard-data.ts?raw'

const totals = { users: 184, CURRENT: 120, EXPIRING_SOON: 21, EXPIRED: 30 }
const payment = (id: string, accreditedAt: string, amount: string, status: 'ACCREDITED' | 'VOIDED' = 'ACCREDITED') => ({
  id, accreditedAt, amount, status, method: 'Efectivo', receiptNumber: null, expiresAt: accreditedAt, voidedAt: null, voidReason: null,
  member: { id: 'm', firstName: 'A', lastName: 'B', documentNumber: '1', email: 'a@example.com' },
})

function adminRoutes(overrides: Partial<typeof totals> = {}, payments = [payment('p1', '2026-09-07T13:00:00Z', '10000'), payment('p2', '2026-09-05T13:00:00Z', '5000')]): ApiRoute[] {
  const values = { ...totals, ...overrides }
  return [
    { path: '/users', handler: () => ({ body: { items: [], page: 1, limit: 1, total: values.users } }) },
    { path: '/members', handler: (url) => ({ body: { items: [], page: 1, limit: 1, total: values[url.searchParams.get('membershipStatus') as 'CURRENT' | 'EXPIRING_SOON' | 'EXPIRED'] } }) },
    { path: '/payments/summary', handler: () => ({ body: { from: '', to: '', paymentCount: payments.length, totalAmount: String(payments.reduce((sum, item) => sum + Number(item.amount), 0)) } }) },
    { path: '/payments', handler: () => ({ body: { items: payments, page: 1, limit: 100, total: payments.length } }) },
  ]
}

describe('panel administrativo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-07T15:00:00-03:00'))
    setMobileViewport(false)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renderiza A1 desktop con encabezado, métricas reales y aptos pendientes', async () => {
    const fetchStub = stubApi(adminRoutes())
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN', { firstName: 'Carla' }) })
    expect(screen.getByText('PANEL ADMINISTRATIVO')).toHaveClass('dashboard-pill')
    expect(screen.getByRole('heading', { name: 'Buen día, Carla' })).toBeInTheDocument()
    expect(screen.getByText('Resumen de socios, cuotas, aptos médicos y accesos de M-TEAM.')).toBeInTheDocument()
    expect(await screen.findByText('184')).toBeInTheDocument()
    expect(screen.getByText('141')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    const cards = [...document.querySelectorAll('.status-grid .status-card')]
    expect(cards.map((card) => card.querySelector('.status-card-label')?.textContent)).toEqual(['SOCIOS ACTIVOS', 'CUOTAS AL DÍA', 'CUOTAS VENCIDAS', 'APTOS PENDIENTES'])
    expect(cards[3]).toHaveTextContent('—Backend pendiente')
    expect(cards[3].querySelector('.status-card-value')).toHaveClass('tone-purple')
    const users = requestsTo(fetchStub, 'GET', '/users')[0].url.searchParams
    expect(users.get('role')).toBe('MEMBER')
    expect(users.get('status')).toBe('ACTIVE')
  })

  it('grafica la recaudación real de los últimos 7 días', async () => {
    const fetchStub = stubApi(adminRoutes())
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN') })
    expect(await screen.findByText('$ 15.000')).toHaveClass('revenue-total')
    const bars = screen.getAllByRole('listitem')
    expect(bars).toHaveLength(7)
    expect(bars[6]).toHaveAccessibleName(/^07\/09\/2026: \$\s10\.000$/)
    expect(bars[4]).toHaveAccessibleName(/^05\/09\/2026: \$\s5\.000$/)
    expect(bars[0]).toHaveAccessibleName(/^01\/09\/2026: \$\s0$/)
    expect(bars[6].querySelector('.revenue-bar')).toHaveClass('is-today')
    expect(bars.slice(0, 6).every((bar) => !bar.querySelector('.is-today'))).toBe(true)
    const payments = requestsTo(fetchStub, 'GET', '/payments')[0].url.searchParams
    expect(payments.get('status')).toBe('ACCREDITED')
    expect(payments.get('from')).toBe('2026-09-01T00:00:00-03:00')
    expect(payments.get('to')).toBe('2026-09-08T00:00:00-03:00')
  })

  it('muestra cero sin inventar datos', async () => {
    stubApi(adminRoutes({ users: 0, CURRENT: 0, EXPIRING_SOON: 0, EXPIRED: 0 }, []))
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN') })
    await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(3))
    expect(await screen.findByText('$ 0')).toBeInTheDocument()
  })

  it('una fuente que falla no destruye el resto del panel', async () => {
    stubApi([
      { path: '/users', handler: () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: null } }) },
      { path: '/payments/summary', handler: () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Falló la recaudación', details: null } }) },
      ...adminRoutes(),
    ])
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN') })
    expect(screen.getAllByText('Cargando…')).toHaveLength(3)
    expect(await screen.findByText('141')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument()
    expect(screen.getByText(/Ocurrió un error interno/)).toBeInTheDocument()
    expect(await screen.findByText('Falló la recaudación')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acciones frecuentes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Últimos intentos de acceso' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(2)
  })

  it('las acciones sin backend quedan deshabilitadas y las reales navegan', async () => {
    stubApi(adminRoutes())
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN') })
    const actions = screen.getByRole('heading', { name: 'Acciones frecuentes' }).closest('section')!
    expect(within(actions).getByRole('link', { name: 'Registrar un pago' })).toHaveAttribute('href', '/admin/pagos')
    expect(within(actions).getByRole('link', { name: 'Registrar un pago' })).toHaveClass('button-primary')
    expect(within(actions).getByRole('link', { name: 'Crear una cuenta' })).toHaveAttribute('href', '/admin/usuarios')
    expect(within(actions).getByRole('button', { name: 'Revisar aptos médicos' })).toBeDisabled()
    expect(within(actions).getByRole('button', { name: 'Publicar una novedad' })).toBeDisabled()
    await screen.findByText('184')
  })

  it('completa la fila inferior de A1 con estados neutrales y sin actividad ficticia', async () => {
    stubApi(adminRoutes())
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN') })
    await screen.findByText('184')
    const grid = document.querySelector('.admin-panel-grid')!
    expect([...grid.children].map((child) => child.querySelector('h2')?.textContent)).toEqual([
      'Recaudación de los últimos 7 días',
      'Acciones frecuentes',
      'Últimos intentos de acceso',
      'Período inicial de 20 días',
    ])
    const access = screen.getByRole('heading', { name: 'Últimos intentos de acceso' }).closest('section')!
    expect(within(access).getByRole('status')).toHaveTextContent('Historial de accesos no disponibleEste módulo requiere el backend de control de accesos.')
    expect(within(access).queryAllByRole('listitem')).toHaveLength(0)
    const period = screen.getByRole('heading', { name: 'Período inicial de 20 días' }).closest('section')!
    expect(within(period).getByRole('status')).toHaveTextContent('Backend pendiente')
    expect(within(period).queryByText(/Quedan \d+ días/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Permitido|Rechazado|\d{2}:\d{2}/)
  })

  it('el código del panel no contiene datos simulados', () => {
    for (const source of [adminSource, dataSource]) {
      expect(source).not.toMatch(/mock|fake|sample|Math\.random|setTimeout|Juan|Lucas/i)
    }
  })

  it('mobile MA1: resumen de hoy, métricas 2x2, acciones, más secciones y últimos accesos', async () => {
    setMobileViewport(true)
    stubApi(adminRoutes())
    renderWithSession(<AdminDashboardScreen/>, { user: testUser('ADMIN', { firstName: 'Carla' }) })
    expect(screen.getByRole('heading', { name: 'Buen día, Carla' })).toBeInTheDocument()
    expect(screen.getByText('Resumen de hoy · 07/09/2026')).toBeInTheDocument()
    expect(screen.queryByText('PANEL ADMINISTRATIVO')).not.toBeInTheDocument()
    await screen.findByText('184')
    expect(document.querySelectorAll('.status-grid > .status-card')).toHaveLength(4)
    const order = [...document.querySelectorAll('.dashboard-screen > *')].map((element) => element.querySelector('h2')?.textContent ?? element.className)
    expect(order).toEqual(['dashboard-header', 'status-grid', 'Acciones frecuentes', 'Más secciones', 'Últimos accesos'])
    const more = screen.getByRole('heading', { name: 'Más secciones' }).closest('section')!
    expect(within(more).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/admin/accesos', '/admin/sedes', '/admin/eventos', '/admin/novedades'])
    expect(within(more).queryByText(/Cerrar sesión/)).not.toBeInTheDocument()
    const access = screen.getByRole('heading', { name: 'Últimos accesos' }).closest('section')!
    expect(within(access).getByRole('status')).toHaveTextContent('Historial de accesos no disponible')
    expect(screen.queryByRole('heading', { name: 'Período inicial de 20 días' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recaudación de los últimos 7 días' })).not.toBeInTheDocument()
  })
})

describe('agregado de recaudación', () => {
  it('agrupa por día de Buenos Aires y excluye anulados', () => {
    const dates = lastSevenDays('2026-09-07')
    expect(dates).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07'])
    const result = groupRevenueByDay([
      { accreditedAt: '2026-09-07T02:30:00Z', amount: '100', status: 'ACCREDITED' },
      { accreditedAt: '2026-09-07T03:30:00Z', amount: '200.50', status: 'ACCREDITED' },
      { accreditedAt: '2026-09-07T12:00:00Z', amount: '999', status: 'VOIDED' },
    ], dates)
    expect(result.find((day) => day.date === '2026-09-06')?.amount).toBe(100)
    expect(result.find((day) => day.date === '2026-09-07')?.amount).toBe(200.5)
  })
})

describe('inicio de socio y entrenador', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-07T09:00:00-03:00'))
    setMobileViewport(false)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const schedule = {
    id: 's1',
    weekStartsOn: '2026-09-07',
    classes: [
      { id: 'past', activity: 'Madrugada', day: '2026-09-07', startTime: '07:00', startsAt: '2026-09-07T07:00:00-03:00', branch: { id: 'b', name: 'Centro' }, trainer: { id: 'trainer-id', firstName: 'Ana', lastName: 'Gómez' } },
      { id: 'today', activity: 'Funcional', day: '2026-09-07', startTime: '18:00', startsAt: '2026-09-07T18:00:00-03:00', branch: { id: 'b', name: 'Centro' }, trainer: { id: 'trainer-id', firstName: 'Ana', lastName: 'Gómez' } },
      { id: 'other', activity: 'Yoga', day: '2026-09-08', startTime: '10:00', startsAt: '2026-09-08T10:00:00-03:00', branch: { id: 'b', name: 'Centro' }, trainer: { id: 'x', firstName: 'Bruno', lastName: 'Díaz' } },
    ],
  }

  it('el socio ve cuota, pagos y próximas clases reales', async () => {
    stubApi([
      { path: '/members/me/membership', handler: () => ({ body: { currentPrice: '25000', lastPaymentAt: '2026-09-01T12:00:00Z', expiresAt: '2026-10-01T12:00:00Z', daysRemaining: 24, status: 'CURRENT' } }) },
      { path: '/members/me/payments', handler: () => ({ body: { items: [payment('p1', '2026-09-01T12:00:00Z', '25000')], page: 1, limit: 3, total: 1 } }) },
      { path: '/weekly-schedules', handler: () => ({ body: schedule }) },
    ])
    renderWithSession(<MemberDashboardScreen/>, { user: testUser('MEMBER', { firstName: 'Sofía' }) })
    expect(await screen.findByText('Al día')).toBeInTheDocument()
    expect(screen.getByText('24 días restantes')).toBeInTheDocument()
    expect(screen.getAllByText('$ 25.000')).toHaveLength(2)
    expect(screen.getByText('Funcional')).toBeInTheDocument()
    expect(screen.queryByText('Madrugada')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver historial' })).toHaveAttribute('href', '/socio/pagos')
    expect(screen.getByRole('link', { name: 'Conocé a los entrenadores' })).toHaveAttribute('href', '/socio/entrenadores')
  })

  it('el entrenador ve la cantidad real de clases asignadas', async () => {
    stubApi([{ path: '/weekly-schedules', handler: () => ({ body: schedule }) }])
    renderWithSession(<TrainerDashboardScreen/>, { user: testUser('TRAINER', { id: 'trainer-id' }) })
    const today = await screen.findByText('CLASES DE HOY')
    expect(today.nextSibling).toHaveTextContent('2')
    expect(screen.getByText('CLASES DE LA SEMANA').nextSibling).toHaveTextContent('2')
    expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
  })
})
