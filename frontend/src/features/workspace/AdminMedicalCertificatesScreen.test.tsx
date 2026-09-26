import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'

const item = {
  id: 'cert-1', memberId: 'member-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910', email: 'lucas@example.com' },
  reviewedBy: null,
} as const

describe('bandeja administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('lista los socios y obtiene totales reales por estado sin inventar el período inicial', async () => {
    const fetchStub = stubApi([{ path: '/medical-certificates', handler: (url) => {
      const totals = { PENDING: 7, APPROVED: 162, REJECTED: 4 }
      const status = url.searchParams.get('status') as keyof typeof totals | null
      return { body: { items: status ? [] : [item], page: 1, limit: Number(url.searchParams.get('limit')), total: status ? totals[status] : 173 } }
    } }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN'), route: '/admin/aptos' })
    expect((await screen.findAllByText('Lucas Torres')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByText('162')).toBeInTheDocument())
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Sin dato disponible')).toBeInTheDocument()
    expect(screen.getAllByText('Documento de apto médico').length).toBeGreaterThan(0)
    expect(screen.getByText('Revisar')).toHaveAttribute('href', '/admin/aptos/cert-1')
    expect(requestsTo(fetchStub, 'GET', '/medical-certificates')).toHaveLength(4)
  })

  it.each([
    ['2026-09-26', '2026-09-27'],
    ['2026-09-30', '2026-10-01'],
  ])('envía búsqueda, estado y el día %s con hasta exclusivo en Buenos Aires', async (selected, next) => {
    const fetchStub = stubApi([{ path: '/medical-certificates', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    await screen.findByText('No hay certificados que coincidan con los filtros.')
    fireEvent.change(screen.getByLabelText('Buscar por socio o documento'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'REJECTED' } })
    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: selected } })
    fireEvent.change(screen.getByLabelText('Fecha hasta'), { target: { value: selected } })
    await waitFor(() => {
      const filtered = requestsTo(fetchStub, 'GET', '/medical-certificates').find(({ url }) =>
        url.searchParams.get('search') === 'Lucas' && url.searchParams.get('status') === 'REJECTED' &&
        url.searchParams.get('from') === `${selected}T00:00:00-03:00` &&
        url.searchParams.get('to') === `${next}T00:00:00-03:00`)
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
    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-09-26' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'PENDING' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/medical-certificates').some(({ url }) =>
      url.searchParams.get('page') === '2' && url.searchParams.get('status') === 'PENDING')).toBe(true))
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('muestra el error real de la API cuando la bandeja no carga', async () => {
    stubApi([{ path: '/medical-certificates', handler: () => ({ status: 503, body: { code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
  })
})
