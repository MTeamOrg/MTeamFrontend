import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessScanScreen } from './AccessScanScreen'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'

let scanCallback: ((result: { getText: () => string } | null, error: unknown, controls: { stop: () => void }) => void) | undefined
const scannerVideos: unknown[] = []
let cameraFailure: Error | undefined
let isPermissionPending = false

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice(_device: unknown, video: unknown, callback: typeof scanCallback) {
      scannerVideos.push(video)
      scanCallback = callback
      if (cameraFailure) return Promise.reject(cameraFailure)
      if (isPermissionPending) return new Promise(() => {})
      return Promise.resolve({ stop: vi.fn() })
    }
  },
}))

describe('AccessScanScreen', () => {
  afterEach(() => {
    cleanup()
    scanCallback = undefined
    scannerVideos.length = 0
    cameraFailure = undefined
    isPermissionPending = false
    vi.clearAllMocks()
  })

  it.each(['MEMBER', 'TRAINER'] as const)('sends the scanned fixed token and shows the authoritative result for %s', async (role) => {
    const fetchStub = stubApi([{ method: 'POST', path: '/access-attempts', handler: () => ({ status: 201, body: {
      id: 'attempt-id', userId: 'member-id', roleAtAttempt: 'MEMBER', branchId: 'branch-id', accessPointId: 'point-id',
      result: 'ALLOWED', denialReason: null, attemptedAt: '2026-10-05T12:00:00.000Z',
      branch: { id: 'branch-id', name: 'Belgrano' }, accessPoint: { id: 'point-id', name: 'Molinete 1' },
    } }) }])
    renderWithSession(<AccessScanScreen role={role}/>, { user: {
      id: 'member-id', firstName: 'Sofía', lastName: 'Prueba', email: 'member@example.com', role, status: 'ACTIVE', isPasswordChangeRequired: false,
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
    await waitFor(() => expect(scanCallback).toBeDefined())
    scanCallback?.({ getText: () => 'fixed-access-token' }, undefined, { stop: vi.fn() })

    expect(await screen.findByRole('heading', { name: 'ACCESO PERMITIDO' })).toBeInTheDocument()
    expect(screen.getByText('Belgrano')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/access-attempts')[0]?.body).toEqual({ qrToken: 'fixed-access-token' })
    expect(scannerVideos[0]).toBeInstanceOf(HTMLVideoElement)

    fireEvent.click(screen.getByRole('button', { name: 'Escanear de nuevo' }))
    await waitFor(() => expect(scannerVideos).toHaveLength(2))
    expect(scannerVideos[1]).toBeInstanceOf(HTMLVideoElement)
    scanCallback?.({ getText: () => 'fixed-access-token-2' }, undefined, { stop: vi.fn() })
    expect(await screen.findByRole('heading', { name: 'ACCESO PERMITIDO' })).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/access-attempts').map((request) => request.body)).toEqual([
      { qrToken: 'fixed-access-token' }, { qrToken: 'fixed-access-token-2' },
    ])
  })

  it.each(['MEMBER', 'TRAINER'] as const)('shows the backend denial and its reason for %s', async (role) => {
    stubApi([{ method: 'POST', path: '/access-attempts', handler: () => ({ status: 201, body: {
      id: 'attempt-id', userId: 'member-id', roleAtAttempt: 'MEMBER', branchId: null, accessPointId: null,
      result: 'DENIED', denialReason: 'INVALID_QR', attemptedAt: '2026-10-05T12:00:00.000Z',
      branch: null, accessPoint: null,
    } }) }])
    renderWithSession(<AccessScanScreen role={role}/>, { user: {
      id: 'member-id', firstName: 'Sofía', lastName: 'Prueba', email: 'member@example.com', role, status: 'ACTIVE', isPasswordChangeRequired: false,
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
    await waitFor(() => expect(scanCallback).toBeDefined())
    scanCallback?.({ getText: () => 'altered-token' }, undefined, { stop: vi.fn() })

    expect(await screen.findByRole('heading', { name: 'ACCESO RECHAZADO' })).toBeInTheDocument()
    expect(screen.getByText(/código QR no es válido/i)).toBeInTheDocument()
  })

  describe.each(['MEMBER', 'TRAINER'] as const)('%s camera states', (role) => {
    it('waits for backend validation and sends only one attempt for repeated reads', async () => {
      const fetchStub = stubApi([])
      let finishRequest!: (response: Response) => void
      fetchStub.mockImplementation(() => new Promise<Response>((resolve) => { finishRequest = resolve }))
      renderWithSession(<AccessScanScreen role={role}/>, { user: testUser(role) })
      fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Escaneando código QR'))
      act(() => {
        const decoded = { getText: () => 'fixed-token' }
        scanCallback?.(decoded, undefined, { stop: vi.fn() })
        scanCallback?.(decoded, undefined, { stop: vi.fn() })
      })
      expect(screen.getByRole('status')).toHaveTextContent('Validando el acceso')
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(requestsTo(fetchStub, 'POST', '/access-attempts')).toHaveLength(1)
      await act(async () => finishRequest(new Response(JSON.stringify({ code: 'UNAVAILABLE', message: 'Servicio no disponible' }), { status: 503 })))
      expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
    })

    it('shows pending permission, cancels and ignores a late decode', async () => {
      const fetchStub = stubApi([])
      isPermissionPending = true
      renderWithSession(<AccessScanScreen role={role}/>, { user: testUser(role) })
      expect(screen.getByText('Cómo funciona')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Simular/ })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
      expect(screen.getByRole('status')).toHaveTextContent('Solicitando permiso de cámara')
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar escaneo' }))
      await act(async () => scanCallback?.({ getText: () => 'late-token' }, undefined, { stop: vi.fn() }))
      expect(screen.getByRole('status')).toHaveTextContent('Listo para escanear')
      expect(requestsTo(fetchStub, 'POST', '/access-attempts')).toHaveLength(0)
    })

    it.each(['NotAllowedError', 'NotFoundError'])('explains %s and retries the real camera', async (name) => {
      cameraFailure = Object.assign(new Error('Camera unavailable'), { name })
      renderWithSession(<AccessScanScreen role={role}/>, { user: testUser(role) })
      fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 'Error de cámara'))
      if (name === 'NotAllowedError') expect(screen.getByText(/Abrí los permisos de este sitio/)).toBeInTheDocument()
      cameraFailure = undefined
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar cámara' }))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Escaneando código QR'))
    })

    it('shows an API failure without authorizing access', async () => {
      stubApi([{ method: 'POST', path: '/access-attempts', handler: () => ({ status: 503, body: { code: 'UNAVAILABLE', message: 'Servicio no disponible' } }) }])
      renderWithSession(<AccessScanScreen role={role}/>, { user: testUser(role) })
      fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Escaneando código QR'))
      await act(async () => scanCallback?.({ getText: () => 'real-token' }, undefined, { stop: vi.fn() }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible')
      expect(screen.queryByRole('heading', { name: 'ACCESO PERMITIDO' })).not.toBeInTheDocument()
    })
  })
})
