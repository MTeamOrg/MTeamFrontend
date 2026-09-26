import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { MemberMedicalCertificateScreen } from './MemberMedicalCertificateScreen'

const certificate = {
  id: 'cert-1', fileName: 'apto-medico.pdf', fileUrl: 'https://files.example/cert-1', status: 'APPROVED',
  uploadedAt: '2026-09-01T12:00:00Z', reviewedAt: '2026-09-02T12:00:00Z', reviewComment: null,
} as const

describe('pantalla de apto médico del socio', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra el certificado actual, período inicial e historial que entrega la API', async () => {
    stubApi([{ path: '/medical-certificates/me', handler: () => ({ body: { current: certificate, history: [{ ...certificate, id: 'cert-old', status: 'REJECTED', reviewComment: 'Falta el sello.' }], initialPeriod: { status: 'ACTIVE', startsAt: '2026-09-01', daysRemaining: 6 } } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    expect((await screen.findAllByText('apto-medico.pdf')).length).toBeGreaterThan(0)
    expect(screen.getByText('Período inicial')).toBeInTheDocument()
    expect(screen.getByText(/Falta el sello\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver documento/i })).toHaveAttribute('href', certificate.fileUrl)
  })

  it('valida el archivo antes de enviarlo y envía solo un archivo válido', async () => {
    const fetchStub = stubApi([
      { path: '/medical-certificates/me', handler: () => ({ body: { current: null, history: [] } }) },
      { method: 'POST', path: '/medical-certificates/me', handler: () => ({ body: certificate }) },
    ])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    await screen.findByText('Cargar un nuevo certificado')
    const input = screen.getByLabelText('Seleccionar certificado médico')
    fireEvent.change(input, { target: { files: [new File(['bad'], 'apto.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('PDF, JPG o PNG')
    expect(screen.getByRole('button', { name: 'Enviar certificado' })).toBeDisabled()
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'nuevo.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar certificado' }))
    await waitFor(() => expect(fetchStub).toHaveBeenCalledWith(expect.stringContaining('/medical-certificates/me'), expect.objectContaining({ method: 'POST' })))
  })
})
