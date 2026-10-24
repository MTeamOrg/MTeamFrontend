import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, gymDate } from '../../service/date-time'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'

const item = {
  id: 'cert-1', memberId: 'member-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Nora', lastName: 'Campos', documentNumber: '50.123.456', email: 'nora@example.com' },
  reviewedBy: null,
} as const

const approvedItem = {
  ...item,
  id: 'cert-2', status: 'APPROVED', uploadedAt: '2026-09-02T18:00:00Z',
} as const

const rejectedItem = {
  ...item,
  id: 'cert-3', status: 'REJECTED', uploadedAt: '2026-09-01T16:30:00Z', reviewComment: 'Falta la firma.',
} as const

describe('bandeja administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('lista los socios y obtiene métricas completas desde los resúmenes disponibles', async () => {
    const fetchStub = stubApi([
      { path: '/admin/dashboard/metrics', handler: () => ({ body: { activeMembers: 24, inactiveMembers: 2, currentMemberships: 21, expiringMemberships: 1, expiredMemberships: 3, pendingMedicalCertificates: 7, rejectedMedicalCertificates: 4, initialPeriodMembers: 3 } }) },
      { path: '/medical-certificates', handler: (url) => {
        const isApprovedMetric = url.searchParams.get('status') === 'APPROVED'
        return { body: { items: isApprovedMetric ? [] : [item, approvedItem, rejectedItem], page: 1, limit: Number(url.searchParams.get('limit')), total: isApprovedMetric ? 162 : 173 } }
      } },
    ])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN'), route: '/admin/aptos' })
    expect((await screen.findAllByText('Nora Campos')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText('162 aptos')).toBeInTheDocument())
    expect(screen.getByText('7 aptos')).toBeInTheDocument()
    expect(screen.getByText('4 aptos')).toBeInTheDocument()
    expect(screen.getByText('3 socios')).toBeInTheDocument()
    expect(screen.getByText('Sin fecha de vencimiento')).toBeInTheDocument()
    expect(screen.getByText('Esperando una nueva carga')).toBeInTheDocument()
    expect(screen.getByText('Pueden ingresar sin apto')).toBeInTheDocument()
    expect(screen.getAllByText('Documento de apto médico').length).toBeGreaterThan(0)
    expect(screen.getByRole('columnheader', { name: 'Documento' })).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por estado')).toHaveValue('PENDING')
    expect(screen.getByLabelText('Filtrar por fecha de carga')).toHaveValue('')
    expect(screen.getByText('Revisar')).toHaveAttribute('href', '/admin/aptos/cert-1')
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveClass('button-primary')
    expect(screen.getAllByRole('link', { name: 'Ver' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Ver' }).every((link) => link.classList.contains('button-secondary'))).toBe(true)
    expect(requestsTo(fetchStub, 'GET', '/admin/dashboard/metrics')).toHaveLength(1)
    expect(requestsTo(fetchStub, 'GET', '/medical-certificates')).toHaveLength(2)
  })

  it('envía búsqueda, estado y período usando los filtros soportados por la API', async () => {
    const fetchStub = stubApi([{ path: '/medical-certificates', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    await screen.findByText('No hay certificados que coincidan con los filtros.')
    fireEvent.change(screen.getByLabelText('Buscar por socio o documento'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'REJECTED' } })
    fireEvent.change(screen.getByLabelText('Filtrar por fecha de carga'), { target: { value: 'LAST_7_DAYS' } })
    await waitFor(() => {
      const filtered = requestsTo(fetchStub, 'GET', '/medical-certificates').find(({ url }) =>
        url.searchParams.get('search') === 'Lucas' && url.searchParams.get('status') === 'REJECTED' &&
        url.searchParams.get('from') === `${addDays(gymDate(), -6)}T00:00:00-03:00` &&
        url.searchParams.get('to') === `${addDays(gymDate(), 1)}T00:00:00-03:00`)
      expect(filtered).toBeDefined()
      expect(filtered?.url.searchParams.get('page')).toBe('1')
      expect(filtered?.url.searchParams.get('limit')).toBe('20')
    })
  })

  it('mantiene filtros y paginación disponibles en la lista móvil', async () => {
    setMobileViewport(true)
    const fetchStub = stubApi([{ path: '/medical-certificates', handler: (url) => ({ body: {
      items: [item], page: Number(url.searchParams.get('page')), limit: 20, total: 21,
    } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar filtros' }))
    expect(screen.getByRole('button', { name: 'Mostrar filtros' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByLabelText('Filtrar por fecha de carga'), { target: { value: 'LAST_7_DAYS' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'PENDING' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/medical-certificates').some(({ url }) =>
      url.searchParams.get('page') === '2' && url.searchParams.get('status') === 'PENDING')).toBe(true))
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('mantiene solo los resúmenes principales en la composición móvil', async () => {
    setMobileViewport(true)
    stubApi([{ path: '/medical-certificates', handler: () => ({ body: { items: [item], page: 1, limit: 20, total: 1 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Nora Campos')
    expect(document.querySelectorAll('.medical-admin-metric')).toHaveLength(4)
    expect(document.querySelectorAll('.medical-admin-metric-desktop-only')).toHaveLength(2)
  })

  it('muestra el error real de la API cuando la bandeja no carga', async () => {
    stubApi([{ path: '/medical-certificates', handler: () => ({ status: 503, body: { code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
  })
})
