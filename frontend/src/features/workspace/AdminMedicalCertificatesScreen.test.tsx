import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalCertificatesScreen } from './AdminMedicalCertificatesScreen'

const item = {
  id: 'cert-1', fileName: 'apto-lucas.pdf', fileUrl: 'https://files.example/cert-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910' },
  membership: { status: 'ACTIVE', expiresAt: '2026-09-20' },
} as const

describe('bandeja administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra métricas solo cuando la API las entrega y lista los socios', async () => {
    stubApi([{ path: '/admin/medical-certificates', handler: () => ({ body: { items: [item], page: 1, limit: 20, total: 1, metrics: { pending: 7, approved: 162, rejected: 4, initialPeriod: 2 } } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect((await screen.findAllByText('Lucas Torres')).length).toBeGreaterThan(0)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('162')).toBeInTheDocument()
    expect(screen.getByText('Revisar')).toBeInTheDocument()
  })

  it('envía búsqueda y filtro de estado al cliente API', async () => {
    const fetchStub = stubApi([{ path: '/admin/medical-certificates', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    await screen.findByText('No hay certificados que coincidan con los filtros.')
    fireEvent.change(screen.getByLabelText('Buscar por socio o documento'), { target: { value: 'Lucas' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'REJECTED' } })
    await waitFor(() => {
      const urls = fetchStub.mock.calls.map(([input]) => String(input))
      expect(urls.some((url) => url.includes('search=Lucas') && url.includes('status=REJECTED'))).toBe(true)
    })
  })

  it('muestra el error real de la API cuando la bandeja no carga', async () => {
    stubApi([{ path: '/admin/medical-certificates', handler: () => ({ status: 503, body: { code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible' } }) }])
    renderWithSession(<AdminMedicalCertificatesScreen/>, { user: testUser('ADMIN') })
    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio temporalmente no disponible')
  })
})
