import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, stubApi, testUser } from '../../test/test-utils'
import { AdminMedicalReviewScreen } from './AdminMedicalReviewScreen'

const pending = {
  id: 'cert-1', memberId: 'member-1', status: 'PENDING',
  uploadedAt: '2026-09-03T20:14:00Z', reviewedAt: null, reviewComment: null,
  member: { id: 'member-1', firstName: 'Lucas', lastName: 'Torres', documentNumber: '44.870.910', email: 'lucas@example.com' },
  reviewedBy: null,
} as const

describe('revisión administrativa de aptos médicos', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('exige una observación no vacía para rechazar', async () => {
    const fetchStub = stubApi([{ path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) }])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('obligatoria')
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })

  it('rechaza con comentario y envía el PATCH real', async () => {
    const rejected = { ...pending, status: 'REJECTED', reviewComment: 'La imagen está cortada.' }
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { method: 'PATCH', path: '/medical-certificates/cert-1/review', handler: () => ({ body: rejected }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.change(screen.getByRole('textbox', { name: 'Observación para el socio' }), { target: { value: 'La imagen está cortada.' } })
    fireEvent.click(screen.getByRole('button', { name: /rechazar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue rechazado.')).toBeInTheDocument())
    const reviewCall = fetchStub.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(reviewCall?.[1]?.body).toBe(JSON.stringify({ status: 'REJECTED', reviewComment: 'La imagen está cortada.' }))
  })

  it('aprueba y envía el PATCH con APPROVED', async () => {
    const approved = { ...pending, status: 'APPROVED' }
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { method: 'PATCH', path: '/medical-certificates/cert-1/review', handler: () => ({ body: approved }) },
    ])
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /aprobar apto médico/i }))
    await waitFor(() => expect(screen.getByText('El certificado fue aprobado.')).toBeInTheDocument())
    const reviewCall = fetchStub.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(reviewCall?.[1]?.body).toBe(JSON.stringify({ status: 'APPROVED' }))
  })

  it('obtiene la URL temporal al abrir el archivo', async () => {
    const fetchStub = stubApi([
      { path: '/medical-certificates/cert-1', handler: () => ({ body: pending }) },
      { path: '/medical-certificates/cert-1/file', handler: () => ({ body: { signedUrl: 'https://signed.example/cert-1', expiresIn: 300 } }) },
    ])
    vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithSession(<AdminMedicalReviewScreen id="cert-1"/>, { user: testUser('ADMIN') })
    await screen.findAllByText('Lucas Torres')
    fireEvent.click(screen.getByRole('button', { name: /ver documento/i }))
    await waitFor(() => expect(fetchStub.mock.calls.some(([input]) => String(input).includes('/medical-certificates/cert-1/file'))).toBe(true))
  })
})
