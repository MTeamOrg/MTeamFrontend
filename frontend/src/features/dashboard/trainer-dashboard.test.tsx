import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { TrainerDashboardScreen } from './TrainerDashboardScreen'

const trainer = testUser('TRAINER')
const assignedClass = { id: 'c1', activity: 'Funcional', day: '2026-09-07', startsAt: '2026-09-07T18:00:00-03:00', startTime: '18:00', branch: { id: 'b1', name: 'Belgrano' }, trainer }
const page = { items: [], page: 1, limit: 3, total: 0 }
const routes = [
  { path: '/trainer/classes', handler: () => ({ body: { id: 's1', weekStartsOn: '2026-09-07', classes: [assignedClass, { ...assignedClass, id: 'other', activity: 'Yoga', trainer: { ...trainer, id: 'other' } }] } }) },
  { path: '/news-posts', handler: () => ({ body: page }) },
  { path: '/branches', handler: () => ({ body: page }) },
  { path: '/notifications', handler: () => ({ body: { ...page, total: 2 } }) },
]
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-08T01:30:00Z')); setMobileViewport(false) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
it('desktop uses authenticated classes, gym timezone and existing routes', async () => {
  const fetchStub = stubApi(routes)
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  expect(screen.getByText('Cargando clases…')).toBeInTheDocument()
  expect(await screen.findByText('Funcional')).toBeInTheDocument()
  expect(screen.queryByText('Yoga')).not.toBeInTheDocument()
  expect(screen.getByText(/Tenés 1 clase asignada/)).toBeInTheDocument()
  expect(screen.getByText('2 sin leer')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir escáner QR' })).toHaveAttribute('href', '/entrenador/acceso')
  expect(screen.getByRole('link', { name: 'Ver mis clases' })).toHaveAttribute('href', '/entrenador/clases')
  expect(requestsTo(fetchStub, 'GET', '/trainer/classes')[0].url.searchParams.get('weekStartsOn')).toBe('2026-09-07')
  expect(requestsTo(fetchStub, 'GET', '/weekly-schedules')).toHaveLength(0)
  expect(requestsTo(fetchStub, 'GET', '/notifications')[0].url.searchParams.get('isRead')).toBe('false')
})
it('mobile keeps two metrics, a QR action and compact classes without extra navigation', async () => {
  setMobileViewport(true); stubApi(routes)
  renderWithSession(<TrainerDashboardScreen/>, { user: { ...trainer, status: 'INACTIVE' } })
  await screen.findByText('Funcional')
  expect(document.querySelectorAll('.trainer-status-grid .status-card')).toHaveLength(2)
  expect(screen.getByText('Cuenta no habilitada')).toBeInTheDocument()
  expect(screen.queryByText('CLASES DE LA SEMANA')).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Nuestras sedes' })).toBeInTheDocument()
  const more = screen.getByRole('heading', { name: /secciones/ }).closest('section')!
  expect(within(more).getByRole('link', { name: 'Novedades' })).toHaveAttribute('href', '/entrenador/novedades')
})
it('isolates failures and allows retrying a failed query', async () => {
  let hasFailed = true
  stubApi([{ path: '/news-posts', handler: () => hasFailed ? { status: 500, body: { message: 'Novedades no disponibles' } } : { body: page } }, ...routes])
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  expect(await screen.findByText('Novedades no disponibles')).toBeInTheDocument()
  expect(screen.getByText('Funcional')).toBeInTheDocument()
  hasFailed = false
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('No hay novedades publicadas para mostrar.')).toBeInTheDocument()
})
it('renders independent empty states and never guarantees access', async () => {
  stubApi([{ path: '/trainer/classes', handler: () => ({ body: { classes: [] } }) }, ...routes])
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  await waitFor(() => expect(screen.getByText('No tenés clases asignadas para hoy.')).toBeInTheDocument())
  expect(await screen.findByText('No hay sedes disponibles para mostrar.')).toBeInTheDocument()
  expect(screen.getByText('El acceso se valida al escanear el QR')).toBeInTheDocument()
  expect(screen.queryByText('Acceso habilitado')).not.toBeInTheDocument()
})
it.each(['/trainer/classes', '/branches', '/notifications'])('keeps the dashboard available when %s fails', async (path) => {
  stubApi([{ path, handler: () => ({ status: 500, body: { message: 'Consulta no disponible' } }) }, ...routes])
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  expect(await screen.findByText('Consulta no disponible')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir escáner QR' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Nuestras sedes' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
})
it('shows trainer publications and branch details with directions from the API', async () => {
  const post = { id: 'n1', title: 'Nueva actividad', status: 'PUBLISHED', audience: 'TRAINERS' }
  stubApi([
    { path: '/news-posts', handler: () => ({ body: { ...page, items: [post, { ...post, id: 'n2', title: 'Solo socios', audience: 'MEMBERS' }] } }) },
    { path: '/branches', handler: () => ({ body: { ...page, items: [{ id: 'b1', name: 'Villa Urquiza', imageUrl: '', address: 'Calle 123', openingHours: '8 a 23', phone: '123456', isActive: false }] } }) },
    ...routes,
  ])
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  expect(await screen.findByRole('link', { name: 'Nueva actividad' })).toHaveAttribute('href', '/entrenador/novedades')
  expect(screen.queryByText('Solo socios')).not.toBeInTheDocument()
  expect(await screen.findByText('Inactiva')).toBeInTheDocument()
  expect(screen.getByText('8 a 23')).toBeInTheDocument()
  expect(screen.getByText('123456')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute('href', expect.stringContaining('Calle%20123'))
})
it('keeps trainer branch information available when directions cannot be generated', async () => {
  stubApi([
    { path: '/branches', handler: () => ({ body: { ...page, items: [{ id: 'b1', name: 'Sede sin ubicación', imageUrl: '', address: '', openingHours: '8 a 23', phone: '123456', isActive: true }] } }) },
    ...routes,
  ])
  renderWithSession(<TrainerDashboardScreen/>, { user: trainer })
  expect(await screen.findByText('Sede sin ubicación')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: /Cómo llegar no disponible/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Cómo llegar' })).not.toBeInTheDocument()
})
