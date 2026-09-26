import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'

const item = {
  id: 'cert-1', memberId: 'member-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910', email: 'lucas@example.com' },
  reviewedBy: null,
} as const

describe('bandeja administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('lista los socios sin inventar métricas ni nombre de archivo', async () => {
    stubApi([{ path: '/medical-certificates', handler: () => ({ body: { items: [item], page: 1, limit: 20, total: 1 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect((await screen.findAllByText('Lucas Torres')).length).toBeGreaterThan(0)
    expect(screen.getByText(/no entrega métricas agregadas/i)).toBeInTheDocument()
    expect(screen.getAllByText('Archivo médico').length).toBeGreaterThan(0)
    expect(screen.getByText('Revisar')).toBeInTheDocument()
  })

  it('envía búsqueda, estado y fechas ISO con zona horaria', async () => {
    const fetchStub = stubApi([{ path: '/medical-certificates', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    await screen.findByText('No hay certificados que coincidan con los filtros.')
    fireEvent.change(screen.getByLabelText('Buscar por socio o documento'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'REJECTED' } })
    fireEvent.change(screen.getByLabelText('Fecha desde'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Fecha hasta'), { target: { value: '2026-09-03' } })
    await waitFor(() => {
      const urls = fetchStub.mock.calls.map(([input]) => new URL(String(input)))
      const filtered = urls.find((url) => url.searchParams.get('search') === 'Lucas' && url.searchParams.get('status') === 'REJECTED')
      expect(filtered).toBeDefined()
      expect(filtered?.pathname).toBe('/api/medical-certificates')
      expect(filtered?.searchParams.get('page')).toBe('1')
      expect(filtered?.searchParams.get('limit')).toBe('20')
      expect(filtered?.searchParams.get('from')).toMatch(/T.*(?:Z|[+-]\d{2}:?\d{2})$/)
      expect(filtered?.searchParams.get('to')).toMatch(/T.*(?:Z|[+-]\d{2}:?\d{2})$/)
    })
  })

  it('muestra el error real de la API cuando la bandeja no carga', async () => {
    stubApi([{ path: '/medical-certificates', handler: () => ({ status: 503, body: { code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
  })
})
