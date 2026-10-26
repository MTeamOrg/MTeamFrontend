import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { UserDetailScreen } from './UserDetailScreen'
import type { AdminUserDetail } from '../../service/backend-api'
import { backendApi } from '../../service/backend-api'

const member: AdminUserDetail = { id: 'member-1', firstName: 'Marta', lastName: 'Gómez', documentNumber: '12345678', birthDate: '1990-01-01', email: 'marta@example.com', phone: '1100000000', role: 'MEMBER', status: 'ACTIVE', isPasswordChangeRequired: false, photoUrl: null, createdAt: '2026-01-01', memberProfile: { emergencyContactName: 'Contacto real', emergencyContactPhone: '1199999999' }, trainerProfile: null, membership: { status: 'ACTIVE', paymentId: 'p1', expiresAt: '2026-12-01' }, payments: [{ id: 'p1', amount: '100.50', method: 'Efectivo', receiptNumber: 'R1', status: 'ACCREDITED', accreditedAt: '2026-10-01T15:00:00Z', createdAt: '2026-10-01', expiresAt: '2026-12-01', voidedAt: null, voidReason: null }, { id: 'p2', amount: '500', method: 'Efectivo', receiptNumber: null, status: 'VOIDED', accreditedAt: '2026-09-01T15:00:00Z', createdAt: '2026-09-01', expiresAt: '2026-10-01', voidedAt: '2026-09-02', voidReason: 'Error' }], medicalCertificates: [], trainerBranches: [], classes: [] }

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function setup(user = member) {
  const fetchStub = stubApi([
    { path: `/users/${user.id}`, handler: () => ({ body: user }) },
    { path: `/users/${user.id}/audit-logs`, handler: () => ({ body: { items: [] } }) },
    { path: '/access-attempts', handler: () => ({ body: { items: [{ result: 'ALLOWED', attemptedAt: '2026-10-21T15:30:00Z', branch: { name: 'Sede real' }, accessPoint: { name: 'Entrada' } }] } }) },
    { method: 'PATCH', path: `/users/${user.id}`, handler: () => ({ body: user }) },
    { method: 'PATCH', path: `/users/${user.id}/status`, handler: () => ({ body: { ...user, status: 'INACTIVE' } }) },
  ])
  renderWithSession(<UserDetailScreen id={user.id}/>, { user: testUser('ADMIN') })
  return fetchStub
}

it('uses member data and only accredited payments in the summary', async () => {
  const fetchStub = setup()
  expect(await screen.findByRole('heading', { name: 'Marta Gómez', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('1 pagos')).toBeInTheDocument()
  expect(screen.getByText(/100,50 en total/)).toBeInTheDocument()
  expect(screen.getByText('Contacto real')).toBeInTheDocument()
  expect(await screen.findAllByText('21/10 · 12:30')).toHaveLength(2)
  const query = requestsTo(fetchStub, 'GET', '/access-attempts')[0].url.searchParams
  expect(query.get('userId')).toBe('member-1')
  expect(query.get('result')).toBe('ALLOWED')
  expect(screen.queryByText('Último intento de acceso')).not.toBeInTheDocument()
})

it('preserves the existing edit operation and separate state confirmation', async () => {
  const fetchStub = setup()
  fireEvent.click(await screen.findByRole('button', { name: /Editar datos/ }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText('Correo electrónico *'), { target: { value: 'nuevo@example.com' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Guardar datos' }))
  expect(await screen.findByText('Datos actualizados correctamente.')).toBeInTheDocument()
  expect(requestsTo(fetchStub, 'PATCH', '/users/member-1')[0].body).toEqual({ firstName: member.firstName, lastName: member.lastName, documentNumber: member.documentNumber, birthDate: member.birthDate, email: 'nuevo@example.com', phone: member.phone, emergencyContactName: member.memberProfile?.emergencyContactName, emergencyContactPhone: member.memberProfile?.emergencyContactPhone })
  fireEvent.click(screen.getByRole('button', { name: /Desactivar/ }))
  expect(screen.getByRole('dialog', { name: 'Desactivar cuenta' })).toBeInTheDocument()
  expect(requestsTo(fetchStub, 'PATCH', '/users/member-1/status')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows missing member data without copying reference values', async () => {
  setup({ ...member, payments: [], membership: null, memberProfile: null })
  expect(await screen.findByText('Sin cuota')).toBeInTheDocument()
  expect(screen.getByText('No hay pagos registrados.')).toBeInTheDocument()
  expect(screen.getByText('No hay aptos médicos cargados.')).toBeInTheDocument()
  expect(await screen.findByText('No hay acciones registradas.')).toBeInTheDocument()
})

it('distinguishes access errors and permits retry', async () => {
  let hasFailed = false
  stubApi([
    { path: '/users/member-1', handler: () => ({ body: member }) },
    { path: '/users/member-1/audit-logs', handler: () => ({ body: { items: [] } }) },
    { path: '/access-attempts', handler: () => {
      if (!hasFailed) { hasFailed = true; return { status: 503, body: { message: 'Error' } } }
      return { body: { items: [] } }
    } },
  ])
  renderWithSession(<UserDetailScreen id="member-1"/>, { user: testUser('ADMIN') })
  expect(await screen.findAllByRole('alert')).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0])
  expect(await screen.findAllByText('Sin accesos registrados')).toHaveLength(2)
})

it.each(['TRAINER', 'ADMIN'] as const)('keeps %s on its existing detail layout', async (role) => {
  setup({ ...member, role, trainerProfile: { specialty: 'Fuerza', description: 'Perfil' } })
  expect(await screen.findByText(role === 'TRAINER' ? 'Perfil de entrenador' : 'Información administrativa')).toBeInTheDocument()
  expect(document.querySelector('.member-detail-screen')).toBeNull()
})

it('shows access loading separately from loaded member details', async () => {
  vi.spyOn(backendApi, 'listAccessAttempts').mockImplementation(() => new Promise(() => {}))
  setup()
  expect(await screen.findByRole('heading', { name: 'Marta Gómez', level: 1 })).toBeInTheDocument()
  expect(screen.getAllByText('Cargando acceso…')).toHaveLength(2)
  expect(screen.queryByText('Sin accesos registrados')).not.toBeInTheDocument()
})

it('offers retry when account-history loading fails', async () => {
  vi.spyOn(backendApi, 'listUserAuditLogs').mockRejectedValueOnce(new Error('Historial no disponible')).mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 })
  setup()
  expect(await screen.findByText('Historial no disponible')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('No hay acciones registradas.')).toBeInTheDocument()
})
