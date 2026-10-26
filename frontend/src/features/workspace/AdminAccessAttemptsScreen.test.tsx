import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, gymDate } from '../../service/date-time'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { AdminAccessAttemptsScreen } from './AdminAccessAttemptsScreen'

const branch = { id: 'branch-1', name: 'Sede de prueba' }

const allowedAttempt = {
  id: 'attempt-1',
  userId: 'user-1',
  roleAtAttempt: 'MEMBER',
  result: 'ALLOWED',
  denialReason: null,
  attemptedAt: '2026-10-10T15:30:00.000Z',
  user: { id: 'user-1', firstName: 'Marta', lastName: 'G\u00f3mez', documentNumber: '40123456' },
  branch,
  accessPoint: { id: 'point-1', name: 'Entrada principal' },
} as const

const deniedAttempt = {
  ...allowedAttempt,
  id: 'attempt-2',
  result: 'DENIED',
  denialReason: 'EXPIRED_MEMBERSHIP',
} as const

const otherAllowedAttempt = {
  ...allowedAttempt,
  id: 'attempt-3',
  userId: 'user-2',
  user: { id: 'user-2', firstName: 'Diego', lastName: 'Ruiz', documentNumber: '40987654' },
} as const

const pageResponse = (items: unknown[], page = 1, limit = 20, total = items.length) => ({
  items, page, limit, total,
})

function accessRoutes(handler: (url: URL) => { body?: unknown; status?: number }) {
  return [
    { path: '/access-attempts', handler },
    { path: '/admin/branches', handler: () => ({ body: pageResponse([branch], 1, 100) }) },
  ]
}

describe('pantalla administrativa de accesos', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra el estado de carga y luego los intentos y resumen reales', async () => {
    const fetchStub = stubApi(accessRoutes((url) => {
      if (url.searchParams.get('limit') === '100') return { body: pageResponse([allowedAttempt, deniedAttempt, otherAllowedAttempt], 1, 100, 5) }
      if (url.searchParams.get('result') === 'ALLOWED') return { body: pageResponse([allowedAttempt], 1, 1, 3) }
      if (url.searchParams.get('result') === 'DENIED') return { body: pageResponse([deniedAttempt], 1, 1, 2) }
      return { body: pageResponse([allowedAttempt, deniedAttempt], 1, 20, 5) }
    }))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN'), route: '/admin/accesos' })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findAllByText('Marta G\u00f3mez')).toHaveLength(4)
    expect(screen.getAllByText('Permitido')).toHaveLength(2)
    expect(screen.getAllByText('Rechazado \u00b7 Cuota vencida')).toHaveLength(2)
    expect(screen.getByText('5 accesos')).toBeInTheDocument()
    expect(screen.getByText('3 accesos')).toBeInTheDocument()
    expect(screen.getByText('2 accesos')).toBeInTheDocument()
    expect(screen.getByText('2 socios')).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por período')).toHaveValue('TODAY')
    expect(screen.getByRole('columnheader', { name: 'Fecha y hora' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Documento' })).not.toBeInTheDocument()
    expect(requestsTo(fetchStub, 'GET', '/access-attempts')).toHaveLength(4)
  })

  it('muestra el historial aunque el resumen no esté disponible', async () => {
    stubApi(accessRoutes((url) => url.searchParams.get('limit') === '20'
      ? { body: pageResponse([allowedAttempt]) }
      : { status: 503, body: { message: 'Resumen no disponible' } }))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByText('No se pudo cargar el resumen de hoy. El historial sigue disponible.')).toBeInTheDocument()
    expect(screen.getAllByText('Marta G\u00f3mez')).toHaveLength(2)
  })

  it('muestra un estado vac\u00edo cuando no hay resultados', async () => {
    stubApi(accessRoutes(() => ({ body: pageResponse([]) })))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByText('No hay intentos de ingreso que coincidan con los filtros.')).toBeInTheDocument()
  })

  it('permite reintentar la carga despu\u00e9s de un error', async () => {
    let shouldFail = true
    const fetchStub = stubApi(accessRoutes((url) => {
      if (url.searchParams.get('limit') === '20' && shouldFail) return { status: 503, body: { message: 'Servicio temporalmente no disponible' } }
      return { body: pageResponse([allowedAttempt]) }
    }))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
    shouldFail = false
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findAllByText('Marta G\u00f3mez')).toHaveLength(2)
    expect(requestsTo(fetchStub, 'GET', '/access-attempts').filter(({ url }) => url.searchParams.get('limit') === '20')).toHaveLength(2)
  })

  it('env\u00eda b\u00fasqueda, sede, rol, resultado y per\u00edodo', async () => {
    const fetchStub = stubApi(accessRoutes(() => ({ body: pageResponse([]) })))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })
    await screen.findByText('No hay intentos de ingreso que coincidan con los filtros.')

    fireEvent.change(screen.getByLabelText('Buscar por usuario o documento'), { target: { value: ' Marta ' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar por usuario o documento'), { key: 'Enter', code: 'Enter' })
    fireEvent.change(screen.getByLabelText('Filtrar por sede'), { target: { value: 'branch-1' } })
    fireEvent.change(screen.getByLabelText('Filtrar por rol'), { target: { value: 'MEMBER' } })
    fireEvent.change(screen.getByLabelText('Filtrar por resultado'), { target: { value: 'DENIED' } })
    fireEvent.change(screen.getByLabelText('Filtrar por per\u00edodo'), { target: { value: 'LAST_7_DAYS' } })

    await waitFor(() => {
      const today = gymDate()
      const request = requestsTo(fetchStub, 'GET', '/access-attempts').find(({ url }) =>
        url.searchParams.get('search') === 'Marta' &&
        url.searchParams.get('role') === 'MEMBER' &&
        url.searchParams.get('branchId') === 'branch-1' &&
        url.searchParams.get('result') === 'DENIED' &&
        url.searchParams.get('from') === `${addDays(today, -6)}T00:00:00-03:00` &&
        url.searchParams.get('to') === `${today}T23:59:59.999-03:00`)
      expect(request).toBeDefined()
      expect(request?.url.searchParams.get('page')).toBe('1')
      expect(request?.url.searchParams.get('limit')).toBe('20')
    })
  })

  it('aplica el rango manual de fechas también en escritorio', async () => {
    const fetchStub = stubApi(accessRoutes(() => ({ body: pageResponse([]) })))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })
    await screen.findByText('No hay intentos de ingreso que coincidan con los filtros.')

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2092-03-03' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2092-03-03' } })

    await waitFor(() => {
      const request = requestsTo(fetchStub, 'GET', '/access-attempts').find(({ url }) =>
        url.searchParams.get('from') === '2092-03-03T00:00:00-03:00' &&
        url.searchParams.get('to') === '2092-03-03T23:59:59.999-03:00')
      expect(request).toBeDefined()
    })
  })

  it('muestra filtros plegables y tarjetas de intentos para celular', async () => {
    setMobileViewport(true)
    const fetchStub = stubApi(accessRoutes(() => ({ body: pageResponse([allowedAttempt, deniedAttempt]) })))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN'), route: '/admin/accesos' })
    expect(await screen.findAllByText('Marta G\u00f3mez')).toHaveLength(4)
    expect(document.querySelectorAll('.access-mobile-card')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mostrar filtros' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar filtros' }))
    expect(document.querySelector('.access-filter-fields.is-open')).toBeInTheDocument()
    expect(screen.getAllByText('Rechazado \u00b7 Cuota vencida')).toHaveLength(2)
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts').some(({ url }) => url.searchParams.get('from') === '2026-10-01T00:00:00-03:00')).toBe(true))
  })

  it('cuenta socios distintos recorriendo todas las páginas del período', async () => {
    const fetchStub = stubApi(accessRoutes((url) => {
      if (url.searchParams.get('limit') === '100') {
        return url.searchParams.get('page') === '2'
          ? { body: pageResponse([otherAllowedAttempt], 2, 100, 101) }
          : { body: pageResponse([allowedAttempt], 1, 100, 101) }
      }
      if (url.searchParams.get('limit') === '1') {
        return { body: pageResponse([], 1, 1, url.searchParams.get('result') === 'ALLOWED' ? 60 : 41) }
      }
      return { body: pageResponse([allowedAttempt], 1, 20, 1) }
    }))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect(await screen.findByText('2 socios')).toBeInTheDocument()
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts').some(({ url }) => url.searchParams.get('limit') === '100' && url.searchParams.get('page') === '2')).toBe(true))
  })

  it('pagina el historial y deshabilita los controles en los extremos', async () => {
    const fetchStub = stubApi(accessRoutes((url) => {
      if (url.searchParams.get('limit') !== '20') return { body: pageResponse([], 1, 1, 0) }
      const currentPage = Number(url.searchParams.get('page'))
      return { body: pageResponse([currentPage === 1 ? allowedAttempt : deniedAttempt], currentPage, 20, 21) }
    }))

    renderWithSession(<AdminAccessAttemptsScreen />, { user: testUser('ADMIN') })

    expect((await screen.findAllByText('Permitido')).length).toBe(2)
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))

    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts').some(({ url }) =>
      url.searchParams.get('limit') === '20' && url.searchParams.get('page') === '2')).toBe(true))
    expect((await screen.findAllByText('Rechazado \u00b7 Cuota vencida')).length).toBe(2)
    expect(screen.getByText('P\u00e1gina 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/access-attempts')
      .filter(({ url }) => url.searchParams.get('limit') === '20' && url.searchParams.get('page') === '1').length).toBeGreaterThan(1))
  })
})
