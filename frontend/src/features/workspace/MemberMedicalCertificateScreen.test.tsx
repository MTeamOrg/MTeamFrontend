import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { MemberMedicalCertificateScreen } from './MemberMedicalCertificateScreen'

const certificate = {
  id: 'cert-1', memberId: 'member-1', status: 'APPROVED',
  uploadedAt: '2026-09-01T12:00:00Z', reviewedAt: '2026-09-02T12:00:00Z', reviewComment: null,
  member: { id: 'member-1', firstName: 'Sofía', lastName: 'Prueba', documentNumber: '44.870.910', email: 'sofia@example.com' },
  reviewedBy: { id: 'admin-1', firstName: 'Lara', lastName: 'Admin' },
} as const

describe('pantalla de apto médico del socio', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra el certificado más reciente, período inicial e historial de la API', async () => {
    const fetchStub = stubApi([
      { path: '/members/me/medical-certificates', handler: () => ({ body: {
        items: [certificate, { ...certificate, id: 'cert-old', status: 'REJECTED', reviewComment: 'Falta el sello.' }],
        page: 1, limit: 20, total: 2,
        initialMedicalCertificatePeriod: {
          startsAt: '2026-09-01T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z', daysRemaining: 6, isActive: true,
        },
      } }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: { signedUrl: 'https://signed.example/cert-1', expiresIn: 300 } }) },
    ])
    vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    expect((await screen.findAllByText('Archivo médico')).length).toBeGreaterThan(0)
    const listUrl = new URL(String(fetchStub.mock.calls[0]?.[0]))
    expect(listUrl.pathname).toBe('/api/members/me/medical-certificates')
    expect(listUrl.searchParams.get('page')).toBe('1')
    expect(listUrl.searchParams.get('limit')).toBe('20')
    expect(screen.getByText('Período inicial')).toBeInTheDocument()
    expect(screen.getByText(/Falta el sello\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver documento/i }))
    await waitFor(() => expect(fetchStub.mock.calls.some(([input]) => String(input).includes('/medical-certificates/cert-1/file'))).toBe(true))
  })

  it('valida el archivo antes de enviarlo y envía solo un archivo válido', async () => {
    const fetchStub = stubApi([
      { path: '/members/me/medical-certificates', handler: () => ({ body: {
        items: [], page: 1, limit: 20, total: 0,
        initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
      } }) },
      { method: 'POST', path: '/members/me/medical-certificates', handler: () => ({ status: 201, body: certificate }) },
    ])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    await screen.findByText('Cargar un nuevo certificado')
    const input = screen.getByLabelText('Seleccionar certificado médico')
    fireEvent.change(input, { target: { files: [new File(['bad'], 'apto.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('PDF, JPG o PNG')
    expect(screen.getByRole('button', { name: 'Enviar certificado' })).toBeDisabled()
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'nuevo.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar certificado' }))
    await waitFor(() => {
      const uploadCall = fetchStub.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(uploadCall).toBeDefined()
      expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData)
      expect((uploadCall?.[1]?.body as FormData).get('file')).toBeInstanceOf(File)
    })
  })
})
