import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { UserDetailScreen } from './UserDetailScreen'
import { UserLastAccessCard } from './UserLastAccessCard'

const attempt = { id: 'a1', userId: 'selected-user', roleAtAttempt: 'MEMBER', attemptedAt: '2026-10-21T15:30:00Z', result: 'ALLOWED', branch: { name: 'Centro' }, accessPoint: { name: 'Molinete 1' } }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it.each(['MEMBER', 'TRAINER'] as const)('places one compact card in the summary for %s', async (role) => {
  const fetchStub = stubApi([
    { path: '/users/selected-user', handler: () => ({ body: { id: 'selected-user', firstName: 'Ana', lastName: 'Lara', documentNumber: '12345678', birthDate: '1990-01-01', email: 'ana@example.com', phone: '1100000000', role, status: 'ACTIVE', createdAt: '2026-01-01', medicalCertificates: [], payments: [], membership: null, trainerBranches: [], classes: [] } }) },
    { path: '/users/selected-user/audit-logs', handler: () => ({ body: { items: [] } }) },
    { path: '/access-attempts', handler: () => ({ body: { items: [attempt] } }) },
  ])
  renderWithSession(<UserDetailScreen id="selected-user"/>, { user: testUser('ADMIN') })
  expect((await screen.findAllByText('21/10 · 12:30')).length).toBeGreaterThan(0)
  const card = screen.getByRole('article', { name: 'Último acceso' })
  expect(card.closest(role === 'MEMBER' ? '.member-detail-summary' : '.user-detail-status-grid')).not.toBeNull()
  expect(within(card).getByText('Centro · Molinete 1')).toBeInTheDocument()
  expect(screen.queryByText('Último intento de acceso')).not.toBeInTheDocument()
  const queries = requestsTo(fetchStub, 'GET', '/access-attempts')
  expect(queries).toHaveLength(1)
  expect(Object.fromEntries(queries[0].url.searchParams)).toEqual({ userId: 'selected-user', result: 'ALLOWED', page: '1', limit: '1' })
})

it('shows an empty state without inventing a timestamp', async () => {
  stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [] } }) }])
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser('ADMIN') })
  expect(await screen.findByText('Sin accesos registrados')).toBeInTheDocument()
  expect(document.querySelector('time')).toBeNull()
})

it('shows loading until the server responds', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser('ADMIN') })
  expect(await screen.findByRole('status')).toHaveTextContent('Cargando acceso…')
  expect(screen.queryByText('Sin accesos registrados')).not.toBeInTheDocument()
})

it('supports retry after failure without reporting an empty history', async () => {
  let hasFailed = false
  stubApi([{ path: '/access-attempts', handler: () => {
    if (!hasFailed) { hasFailed = true; return { status: 503, body: { message: 'Error' } } }
    return { body: { items: [attempt] } }
  } }])
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser('ADMIN') })
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el último acceso.')
  expect(screen.queryByText('Sin accesos registrados')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('21/10 · 12:30')).toBeInTheDocument()
})

it('never presents a denied attempt as a successful entry', async () => {
  stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [{ ...attempt, result: 'DENIED' }] } }) }])
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser('ADMIN') })
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(document.querySelector('time')).toBeNull()
})

it('does not invent missing location names', async () => {
  stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [{ ...attempt, branch: null, accessPoint: null }] } }) }])
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser('ADMIN') })
  expect(await screen.findByText('21/10 · 12:30')).toBeInTheDocument()
  expect(screen.queryByText(/Centro|Molinete/)).not.toBeInTheDocument()
})

it.each(['MEMBER', 'TRAINER'] as const)('preserves administrative-only access for %s viewers', (role) => {
  const fetchStub = stubApi([])
  renderWithSession(<UserLastAccessCard userId="selected-user"/>, { user: testUser(role) })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(fetchStub).not.toHaveBeenCalled()
})
