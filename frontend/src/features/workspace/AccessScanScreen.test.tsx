import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessScanScreen } from './AccessScanScreen'
import { renderWithSession, requestsTo, stubApi } from '../../test/test-utils'

let scanCallback: ((result: { getText: () => string } | null, error: unknown, controls: { stop: () => void }) => void) | undefined

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromVideoDevice(_device: unknown, _video: unknown, callback: typeof scanCallback) {
      scanCallback = callback
      return Promise.resolve({ stop: vi.fn() })
    }
  },
}))

describe('AccessScanScreen', () => {
  afterEach(() => vi.clearAllMocks())

  it('sends the scanned fixed token to the backend and shows its authoritative result', async () => {
    const fetchStub = stubApi([{ method: 'POST', path: '/access-attempts', handler: () => ({ status: 201, body: {
      id: 'attempt-id', userId: 'member-id', roleAtAttempt: 'MEMBER', branchId: 'branch-id', accessPointId: 'point-id',
      result: 'ALLOWED', denialReason: null, attemptedAt: '2026-10-05T12:00:00.000Z',
      branch: { id: 'branch-id', name: 'Belgrano' }, accessPoint: { id: 'point-id', name: 'Molinete 1' },
    } }) }])
    renderWithSession(<AccessScanScreen role="MEMBER"/>, { user: {
      id: 'member-id', firstName: 'Sofía', lastName: 'Prueba', email: 'member@example.com', role: 'MEMBER', status: 'ACTIVE', isPasswordChangeRequired: false,
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Escanear QR' }))
    await waitFor(() => expect(scanCallback).toBeDefined())
    scanCallback?.({ getText: () => 'fixed-access-token' }, undefined, { stop: vi.fn() })

    expect(await screen.findByRole('heading', { name: 'ACCESO PERMITIDO' })).toBeInTheDocument()
    expect(screen.getByText('Belgrano')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/access-attempts')[0]?.body).toEqual({ qrToken: 'fixed-access-token' })
  })
})
