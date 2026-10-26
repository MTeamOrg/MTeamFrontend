import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { ProfileScreen } from './ProfileScreen'

const member = {
  ...testUser('MEMBER', { firstName: 'Caso', lastName: 'Socio', email: 'member.test@example.com' }),
  documentNumber: '00000001',
  birthDate: '1990-01-02',
  phone: '1100000000',
  photoUrl: null,
  memberProfile: { emergencyContactName: 'Contacto Sintético', emergencyContactPhone: '1100000001' },
  trainerProfile: null,
}

const trainer = {
  ...testUser('TRAINER', { firstName: 'Caso', lastName: 'Entrenador', email: 'trainer.test@example.com' }),
  documentNumber: '00000002',
  birthDate: '1990-01-03',
  phone: '1100000002',
  photoUrl: null,
  memberProfile: null,
  trainerProfile: { specialty: 'Especialidad sintética', description: 'Descripción sintética.' },
}

function memberRoutes() {
  return [
    { path: '/users/me', handler: () => ({ body: member }) },
    { path: '/members/me/membership', handler: () => ({ body: { currentPrice: '25000', lastPaymentAt: null, expiresAt: '2030-10-01', daysRemaining: 10, status: 'CURRENT' } }) },
    { path: '/members/me/payments', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) },
    { path: '/members/me/medical-certificates', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0, initialMedicalCertificatePeriod: { startsAt: null, expiresAt: null, daysRemaining: 0, isActive: false } } }) },
  ]
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('mobile profile layout', () => {
  it('shows member contact data in read mode and preserves the edit flow', async () => {
    setMobileViewport(true)
    stubApi(memberRoutes())
    renderWithSession(<ProfileScreen role="MEMBER" onPasswordChange={vi.fn()} onLogout={vi.fn()}/>, { user: member })

    expect(await screen.findByRole('heading', { name: 'Datos personales' })).toBeInTheDocument()
    expect(screen.getByText(member.email)).toBeInTheDocument()
    expect(screen.getByText(member.phone)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contacto de emergencia' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }))
    expect(screen.getByRole('textbox', { name: 'Correo electrónico' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Editar datos' })).toBeInTheDocument()
  })

  it('keeps the trainer mobile sections and edit action available', async () => {
    setMobileViewport(true)
    stubApi([
      { path: '/users/me', handler: () => ({ body: trainer }) },
      { path: '/trainers', handler: () => ({ body: { items: [{ ...trainer, branches: [{ id: 'branch-1', name: 'Sede sintética', address: 'Dirección sintética' }] }], total: 1, page: 1, limit: 100 } }) },
    ])
    renderWithSession(<ProfileScreen role="TRAINER" onPasswordChange={vi.fn()} onLogout={vi.fn()}/>, { user: trainer })

    expect(await screen.findByRole('heading', { name: 'Datos de contacto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Seguridad' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sedes donde trabajás' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar mi perfil' })).toBeInTheDocument()
  })
})
