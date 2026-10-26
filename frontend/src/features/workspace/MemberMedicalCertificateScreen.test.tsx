import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { MemberMedicalCertificateScreen } from './MemberMedicalCertificateScreen'

const certificate = {
  id: 'cert-1', memberId: 'member-1', status: 'APPROVED',
  uploadedAt: '2026-09-01T12:00:00Z', reviewedAt: '2026-09-02T12:00:00Z', reviewComment: null,
  member: { id: 'member-1', firstName: 'Sofía', lastName: 'Prueba', documentNumber: '44.870.910', email: 'sofia@example.com' },
  reviewedBy: { id: 'admin-1', firstName: 'Lara', lastName: 'Admin' },
} as const

describe('pantalla de apto médico del socio', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

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
    const tab = { opener: window, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByRole('heading', { name: 'Certificado actual' })).toBeInTheDocument()
    expect((await screen.findAllByText('Documento de apto médico')).length).toBeGreaterThan(0)
    const listUrl = new URL(String(fetchStub.mock.calls[0]?.[0]))
    expect(listUrl.pathname).toBe('/api/members/me/medical-certificates')
    expect(listUrl.searchParams.get('page')).toBe('1')
    expect(listUrl.searchParams.get('limit')).toBe('20')
    expect(screen.getByText('Período inicial')).toBeInTheDocument()
    expect(screen.getByText(/Falta el sello\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ver documento/i }))
    await waitFor(() => expect(fetchStub.mock.calls.some(([input]) => String(input).includes('/medical-certificates/cert-1/file'))).toBe(true))
    await waitFor(() => expect(tab.location.href).toBe('https://signed.example/cert-1'))
    expect(tab.opener).toBeNull()
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
    await screen.findByRole('button', { name: 'Enviar certificado' })
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

  it.each([
    ['PENDING', false],
    ['APPROVED', false],
    ['REJECTED', true],
  ] as const)('habilita la nueva carga según el estado %s', async (status, canUpload) => {
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [{ ...certificate, status }], page: 1, limit: 20, total: 1,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    await screen.findByText('Documento de apto médico')
    if (canUpload) expect(screen.getByRole('button', { name: 'Enviar certificado' })).toBeDisabled()
    else {
      expect(screen.queryByRole('button', { name: 'Enviar certificado' })).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(status === 'PENDING' ? 'Pendiente de revisión' : 'no vence')
    }
  })

  it('permite cargar cuando todavía no hay apto y no muestra texto técnico', async () => {
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByRole('button', { name: 'Enviar certificado' })).toBeDisabled()
    expect(screen.getByText('Tu período inicial aún no comenzó.')).toBeInTheDocument()
    expect(screen.queryByText(/El backend/)).not.toBeInTheDocument()
  })

  it('expone la composición móvil con carga, cámara y período inicial sin inventar datos', async () => {
    setMobileViewport(true)
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: '2026-09-01T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z', daysRemaining: 6, isActive: true },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    await screen.findByRole('button', { name: 'Enviar certificado' })
    expect(document.querySelector('.medical-mobile-upload-heading')).toHaveTextContent('Cargar un nuevo certificado')
    expect(screen.getByRole('button', { name: /Elegir archivo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sacar una foto' })).toBeInTheDocument()
    const stop = vi.fn()
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sacar una foto' }))
    expect(await screen.findByRole('dialog', { name: 'Tomar foto del certificado' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(stop).toHaveBeenCalled()
    expect(screen.getByText('Período inicial')).toBeInTheDocument()
    expect(screen.getByText(/Durante los primeros 20 días/)).toBeInTheDocument()
    expect(screen.queryByText('Historial de aptos')).toBeInTheDocument()
  })

  it('muestra un mensaje cuando el navegador no ofrece acceso a la cámara', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined })
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    fireEvent.click(await screen.findByRole('button', { name: 'Sacar una foto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu navegador no permite acceder a la cámara')
  })

  it('muestra un mensaje si el usuario deniega el permiso de cámara', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) } })
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    fireEvent.click(await screen.findByRole('button', { name: 'Sacar una foto' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir la cámara')
  })

  it('captura una foto, la selecciona como JPG y detiene la cámara', async () => {
    const stop = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['photo'], { type: 'image/jpeg' })))
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    fireEvent.click(await screen.findByRole('button', { name: 'Sacar una foto' }))
    const video = await screen.findByLabelText('Vista previa de la cámara')
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 })
    fireEvent.click(screen.getByRole('button', { name: 'Tomar foto' }))
    expect(await screen.findByText(/Archivo seleccionado: apto-medico-/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar certificado' })).toBeEnabled()
    expect(stop).toHaveBeenCalled()
  })

  it('acepta drag enter, drag over y drop usando la validación existente', async () => {
    stubApi([{ path: '/members/me/medical-certificates', handler: () => ({ body: {
      items: [], page: 1, limit: 20, total: 0,
      initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false },
    } }) }])
    renderWithSession(<MemberMedicalCertificateScreen/>, { user: testUser('MEMBER') })
    const zone = await screen.findByRole('button', { name: /Arrastrá el archivo/ })
    fireEvent.dragEnter(zone)
    expect(zone).toHaveClass('is-dragging')
    fireEvent.dragOver(zone)
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['bad'], 'apto.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('PDF, JPG o PNG')
    expect(zone).not.toHaveClass('is-dragging')
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['%PDF'], 'apto.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByRole('button', { name: 'Enviar certificado' })).toBeEnabled()
  })
})
