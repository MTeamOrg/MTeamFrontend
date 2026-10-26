import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { UserAccessSummary } from './UserAccessSummary'

const allowed = { id: 'a1', userId: 'user-1', roleAtAttempt: 'MEMBER', attemptedAt: '2026-10-21T15:30:00Z', result: 'ALLOWED', denialReason: null, branch: { id: 'b1', name: 'Centro' }, accessPoint: { id: 'p1', name: 'Entrada principal' } }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('queries the latest allowed entry separately from a newer denied attempt', async () => {
  const fetchStub = stubApi([{ path: '/access-attempts', handler: (url) => ({ body: { items: [url.searchParams.get('result') === 'ALLOWED' ? allowed : { ...allowed, id: 'a2', attemptedAt: '2026-10-22T16:00:00Z', result: 'DENIED', denialReason: 'EXPIRED_MEMBERSHIP' }] } }) }])
  renderWithSession(<UserAccessSummary userId="user-1"/>, { user: testUser('ADMIN') })
  const entry = within(screen.getByRole('region', { name: 'Último ingreso permitido' }))
  const attempt = within(screen.getByRole('region', { name: 'Último intento de acceso' }))
  expect(await entry.findByText('21/10/2026 12:30')).toBeInTheDocument()
  expect(entry.getByText('Permitido')).toBeInTheDocument()
  expect(entry.getByText('Centro')).toBeInTheDocument()
  expect(entry.getByText('Entrada principal')).toBeInTheDocument()
  expect(await attempt.findByText('22/10/2026 13:00')).toBeInTheDocument()
  expect(attempt.getByText('Rechazado')).toBeInTheDocument()
  expect(attempt.getByText('Cuota vencida')).toBeInTheDocument()
  const queries = requestsTo(fetchStub, 'GET', '/access-attempts').map(({ url }) => Object.fromEntries(url.searchParams))
  expect(queries).toEqual(expect.arrayContaining([{ userId: 'user-1', page: '1', limit: '1', result: 'ALLOWED' }, { userId: 'user-1', page: '1', limit: '1' }]))
})

it('distinguishes an empty history from a failed request', async () => {
  stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [] } }) }])
  renderWithSession(<UserAccessSummary userId="user-1"/>, { user: testUser('ADMIN') })
  expect(await screen.findByText('No hay ingresos registrados')).toBeInTheDocument()
  expect(await screen.findByText('No hay intentos de acceso registrados')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('keeps the allowed entry visible when the latest-attempt request fails and supports retry', async () => {
  let hasFailed = false
  stubApi([{ path: '/access-attempts', handler: (url) => {
    if (url.searchParams.has('result')) return { body: { items: [allowed] } }
    if (!hasFailed) { hasFailed = true; return { status: 503, body: { message: 'No se pudieron consultar los accesos' } } }
    return { body: { items: [allowed] } }
  } }])
  renderWithSession(<UserAccessSummary userId="user-1"/>, { user: testUser('ADMIN') })
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar los accesos')
  expect(await within(screen.getByRole('region', { name: 'Último ingreso permitido' })).findByText('Permitido')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await within(screen.getByRole('region', { name: 'Último intento de acceso' })).findByText('Permitido')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it.each(['MEMBER', 'TRAINER'] as const)('does not query or expose administrative access data to %s', (role) => {
  const fetchStub = stubApi([])
  renderWithSession(<UserAccessSummary userId="user-1"/>, { user: testUser(role) })
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
  expect(fetchStub).not.toHaveBeenCalled()
})

it('renders a real allowed attempt with missing location references', async () => {
  stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [{ ...allowed, branch: null, accessPoint: null }] } }) }])
  renderWithSession(<UserAccessSummary userId="user-1"/>, { user: testUser('ADMIN') })
  expect(await screen.findAllByText('Permitido')).toHaveLength(2)
  expect(screen.queryByText('Sede')).not.toBeInTheDocument()
  expect(screen.queryByText('No hay ingresos registrados')).not.toBeInTheDocument()
})
