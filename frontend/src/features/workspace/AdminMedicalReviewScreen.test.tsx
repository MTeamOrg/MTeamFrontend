import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalReviewScreen } from './AdminMedicalReviewScreen'

const pending = {
  id: 'cert-1', fileName: 'apto-lucas.pdf', fileUrl: 'https://files.example/cert-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910' },
  membership: { status: 'ACTIVE', expiresAt: '2026-09-20' },
  initialPeriod: { status: 'ACTIVE', startsAt: '2026-09-01', daysRemaining: 6 },
} as const

describe('revisión administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('exige una observación no vacía para rechazar', async () => {
    const fetchStub = stubApi([{ path: '/admin/medical-certificates/cert-1', handler: () => ({ body: pending }) }])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('obligatoria')
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('rechaza con comentario y actualiza el resultado', async () => {
    const rejected = { ...pending, status: 'REJECTED', reviewComment: 'La imagen está cortada.' }
    const fetchStub = stubApi([
      { path: '/admin/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { method: 'POST', path: '/admin/medical-certificates/cert-1/reject', handler: () => ({ body: rejected }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.change(screen.getByRole('textbox', { name: 'Observación para el socio' }), { target: { value: 'La imagen está cortada.' } })
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue rechazado.')).toBeInTheDocument())
    expect(fetchStub.mock.calls.some(([, init]) => String(init?.body).includes('La imagen está cortada.'))).toBe(true)
  })

  it('aprueba y actualiza el estado', async () => {
    const approved = { ...pending, status: 'APPROVED' }
    const fetchStub = stubApi([
      { path: '/admin/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { method: 'POST', path: '/admin/medical-certificates/cert-1/approve', handler: () => ({ body: approved }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /aprobar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue aprobado.')).toBeInTheDocument())
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
  })
})
