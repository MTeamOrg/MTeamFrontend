import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { AdminAccessAttemptsScreen } from './AdminAccessAttemptsScreen'

const branch = { id: 'branch-1', name: 'Caballito' }

const allowedAttempt = {
  id: 'attempt-1',
  roleAtAttempt: 'MEMBER',
  result: 'ALLOWED',
  denialReason: null,
  attemptedAt: '2026-10-10T15:30:00.000Z',
  user: { id: 'user-1', firstName: 'Marta', lastName: 'Gómez', documentNumber: '40123456' },
  branch,
  accessPoint: { id: 'point-1', name: 'Entrada principal' },
} as const

const deniedAttempt = {
  ...allowedAttempt,
  id: 'attempt-2',
  result: 'DENIED',
  denialReason: 'EXPIRED_MEMBERSHIP',
} as const

const pageResponse = (items: unknown[], page = 1, limit = 20, total = items.length) => ({
  items, page, limit, total,
})

describe('pantalla administrativa de accesos', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra el estado de carga y luego los intentos permitidos y rechazados', async () => {
    const fetchStub = stubApi([
      { path: '/access-attempts', handler: () => ({ body: pageResponse([allowedAttempt, deniedAttempt]) }) },
      { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
    ])

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN'), route: '/admin/accesos' })

    expect(screen.getByRole('status')).toBeInTheDocument()
    await screen.findAllByText('Marta Gómez')
    const responsiveList = document.querySelector('.admin-access-mobile-list') as HTMLElement
    expect(within(responsiveList).getAllByText('Marta Gómez')).toHaveLength(2)
    expect(within(responsiveList).getAllByText('Entrada principal')).toHaveLength(2)
    expect(within(responsiveList).getByText('Permitido')).toBeInTheDocument()
    expect(within(responsiveList).getByText('Rechazado · Cuota vencida')).toBeInTheDocument()
    expect(within(responsiveList).getAllByText('40123456')).toHaveLength(2)
    expect(screen.getByText('2 intentos')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'GET', '/access-attempts')).toHaveLength(1)
  })

  it('muestra un estado vacío cuando no hay resultados', async () => {
    stubApi([
      { path: '/access-attempts', handler: () => ({ body: pageResponse([]) }) },
      { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
    ])

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByText('No hay intentos de ingreso que coincidan con los filtros.')).toBeInTheDocument()
  })

  it('permite reintentar la carga después de un error', async () => {
    let shouldFail = true
    const fetchStub = stubApi([
      { path: '/access-attempts', handler: () => shouldFail
        ? { status: 503, body: { code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }
        : { body: pageResponse([allowedAttempt]) } },
      { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
    ])

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
    shouldFail = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await screen.findAllByText('Marta Gómez')
    expect(await within(document.querySelector('.admin-access-mobile-list') as HTMLElement).findByText('Marta Gómez')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'GET', '/access-attempts')).toHaveLength(2)
  })

  it('envía búsqueda, rol, sede, resultado y rango de fechas en los filtros', async () => {
    const fetchStub = stubApi([
      { path: '/access-attempts', handler: () => ({ body: pageResponse([]) }) },
      { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
    ])

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })
    await screen.findByText('No hay intentos de ingreso que coincidan con los filtros.')

    fireEvent.change(screen.getByLabelText('Buscar por usuario o documento'), { target: { value: ' Marta ' } })
    fireEvent.change(screen.getByLabelText('Filtrar por rol'), { target: { value: 'MEMBER' } })
    fireEvent.change(screen.getByLabelText('Filtrar por sede'), { target: { value: 'branch-1' } })
    fireEvent.change(screen.getByLabelText('Filtrar por resultado'), { target: { value: 'DENIED' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-10' } })

    await waitFor(() => {
      const request = requestsTo(fetchStub, 'GET', '/access-attempts').find(({ url }) =>
        url.searchParams.get('search') === 'Marta' &&
        url.searchParams.get('role') === 'MEMBER' &&
        url.searchParams.get('branchId') === 'branch-1' &&
        url.searchParams.get('result') === 'DENIED' &&
        url.searchParams.get('from') === '2026-10-01T00:00:00-03:00' &&
        url.searchParams.get('to') === '2026-10-10T23:59:59.999-03:00')
      expect(request).toBeDefined()
      expect(request?.url.searchParams.get('page')).toBe('1')
      expect(request?.url.searchParams.get('limit')).toBe('20')
    })
  })

  it('pagina los resultados y deshabilita los controles en los extremos', async () => {
    const fetchStub = stubApi([
      { path: '/access-attempts', handler: (url) => {
        const page = Number(url.searchParams.get('page'))
        return { body: pageResponse([page === 1 ? allowedAttempt : deniedAttempt], page, 20, 21) }
      } },
      { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
    ])

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    await waitFor(() => expect(document.querySelector('.admin-access-mobile-list')).not.toBeNull())
    const responsiveList = document.querySelector('.admin-access-mobile-list') as HTMLElement
    expect(await within(responsiveList).findByText('Permitido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts').some(({ url }) =>
      url.searchParams.get('page') === '2')).toBe(true))
    expect(await within(responsiveList).findByText('Rechazado · Cuota vencida')).toBeInTheDocument()
    expect(screen.getByText('Página 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts')
      .filter(({ url }) => url.searchParams.get('page') === '1')).toHaveLength(2))
  })
})
