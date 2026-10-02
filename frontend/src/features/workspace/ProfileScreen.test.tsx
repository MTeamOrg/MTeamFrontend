import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProfileScreen } from './ProfileScreen'

const profile = {
  id: 'member-id',
  firstName: 'Ana',
  lastName: 'Pérez',
  documentNumber: '30111222',
  birthDate: '1990-01-02',
  email: 'ana@example.com',
  phone: '1100000000',
  photoUrl: null,
  role: 'MEMBER',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
  memberProfile: { emergencyContactName: 'Luis', emergencyContactPhone: '1111111111' },
  trainerProfile: null,
}

describe('perfil conectado', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('carga y actualiza los campos habilitados, reflejando la respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      const pathname = new URL(String(input), 'http://localhost').pathname
      const body = options?.method === 'PATCH' ? JSON.parse(String(options.body)) : null
      if (pathname.endsWith('/users/me')) return Promise.resolve(new Response(JSON.stringify(body ? { ...profile, ...body } : profile), { status: 200 }))
      if (pathname.endsWith('/members/me/membership')) return Promise.resolve(new Response(JSON.stringify({ currentPrice: '25000', lastPaymentAt: '2026-09-01T12:00:00Z', expiresAt: '2026-10-01T12:00:00Z', daysRemaining: 24, status: 'CURRENT' }), { status: 200 }))
      if (pathname.endsWith('/members/me/payments')) return Promise.resolve(new Response(JSON.stringify({ items: [], page: 1, limit: 20, total: 0 }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify({ items: [{ id: 'medical-1', memberId: profile.id, status: 'APPROVED', uploadedAt: '2026-09-01T12:00:00Z', reviewedAt: '2026-09-02T12:00:00Z', reviewComment: null, member: { id: profile.id, firstName: profile.firstName, lastName: profile.lastName, documentNumber: profile.documentNumber, email: profile.email }, reviewedBy: null }], page: 1, limit: 20, total: 1, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } }), { status: 200 }))
    }))
    render(<MemoryRouter><ProfileScreen role="MEMBER" onPasswordChange={() => undefined}/></MemoryRouter>)
    const email = await screen.findByDisplayValue('ana@example.com')
    fireEvent.change(email, { target: { value: 'nueva@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Cambios guardados correctamente.')).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/users/me'), expect.objectContaining({ method: 'PATCH' })))
    const [, options] = vi.mocked(fetch).mock.calls.at(-1) ?? []
    expect(JSON.parse(String(options?.body))).toMatchObject({ email: 'nueva@example.com', phone: '1100000000' })
  })
})
