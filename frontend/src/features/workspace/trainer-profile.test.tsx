import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { ProfileScreen } from './ProfileScreen'
import { backendApi, type OwnProfile } from '../../service/backend-api'

const user = testUser('TRAINER')
const profile = { ...user, documentNumber: '123', birthDate: '1990-01-01', phone: '1100000000', photoUrl: null, memberProfile: null, trainerProfile: { specialty: 'Entrenamiento funcional', description: 'Preparación física personalizada.' } }
const directory = { items: [{ ...profile, branches: [{ id: 'b1', name: 'Sede asignada', address: 'Calle 123' }] }, { ...profile, id: 'other', branches: [{ id: 'b2', name: 'Sede ajena', address: 'Otra calle' }] }], total: 2, page: 1, limit: 100 }
function renderProfile() { return renderWithSession(<ProfileScreen role="TRAINER" onPasswordChange={vi.fn()} onLogout={vi.fn()}/>, { user }) }
const routes = [
  { path: '/users/me', handler: () => ({ body: profile }) },
  { path: '/trainers', handler: () => ({ body: directory }) },
]
beforeEach(() => setMobileViewport(false))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('desktop displays own professional data and only assigned branches', async () => {
  const fetchStub = stubApi(routes); renderProfile()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  expect(await screen.findByText('Sede asignada')).toBeInTheDocument()
  expect(screen.queryByText('Sede ajena')).not.toBeInTheDocument()
  expect(screen.getByText(profile.trainerProfile.description)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Nombre' })).not.toBeInTheDocument()
  expect(requestsTo(fetchStub, 'GET', '/users/me')).toHaveLength(1)
  expect(requestsTo(fetchStub, 'GET', '/users/trainer-id')).toHaveLength(0)
  expect(screen.getByLabelText(/Cambiar fotografía/)).toHaveAttribute('type', 'file')
})
it('mobile opens and cancels contact editing without modifying professional fields', async () => {
  setMobileViewport(true); stubApi(routes); renderProfile()
  await screen.findByText('Sede asignada')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar mi perfil' }))
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: 'changed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByText(profile.phone)).toBeInTheDocument()
})
it('updates only authorized contact fields using the own-profile endpoint', async () => {
  const fetchStub = stubApi([{ method: 'PATCH', path: '/users/me', handler: () => ({ body: { ...profile, email: 'new@example.com' } }) }, ...routes])
  renderProfile()
  fireEvent.change(await screen.findByLabelText('Correo electrónico'), { target: { value: 'new@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Cambios guardados correctamente.')).toBeInTheDocument()
  expect(requestsTo(fetchStub, 'PATCH', '/users/me')[0].body).toEqual({ email: 'new@example.com', phone: profile.phone })
})
it('isolates branch errors and retries without losing the profile', async () => {
  let hasFailed = true
  stubApi([{ path: '/trainers', handler: () => hasFailed ? { status: 503, body: { message: 'Sedes no disponibles' } } : { body: directory } }, ...routes]); renderProfile()
  expect(await screen.findByText('Sedes no disponibles')).toBeInTheDocument()
  expect(screen.getByDisplayValue(profile.email)).toBeInTheDocument()
  hasFailed = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Sede asignada')).toBeInTheDocument()
})
it('retries profile errors', async () => {
  let hasFailed = true
  stubApi([{ path: '/users/me', handler: () => hasFailed ? { status: 503, body: { message: 'Perfil no disponible' } } : { body: profile } }, ...routes]); renderProfile()
  expect(await screen.findByText('Perfil no disponible')).toBeInTheDocument()
  hasFailed = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Sede asignada')).toBeInTheDocument()
})
it.each([[], undefined])('explains empty or unavailable assignments (%s)', async (branches) => {
  stubApi([{ path: '/trainers', handler: () => ({ body: { ...directory, items: [{ ...profile, branches }] } }) }, { path: '/users/me', handler: () => ({ body: { ...profile, trainerProfile: null } }) }]); renderProfile()
  expect(await screen.findByText(branches ? 'No hay sedes activas asignadas para mostrar.' : 'No hay información disponible sobre tus sedes asignadas.')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Resumen del perfil' })).getByText('Especialidad no informada')).toBeInTheDocument()
})
it('finds the authenticated trainer beyond the first directory page', async () => {
  const fetchStub = stubApi([{ path: '/trainers', handler: (url) => ({ body: url.searchParams.get('page') === '1' ? { ...directory, items: [directory.items[1]], limit: 1 } : { ...directory, items: [directory.items[0]], limit: 1 } }) }, ...routes]); renderProfile()
  await waitFor(() => expect(screen.getByText('Sede asignada')).toBeInTheDocument())
  expect(requestsTo(fetchStub, 'GET', '/trainers')).toHaveLength(2)
})

it.each([false, true])('saves professional fields using the server response (mobile: %s)', async (isMobile) => {
  setMobileViewport(isMobile)
  const updated = { ...profile, trainerProfile: { specialty: 'Respuesta del servidor', description: 'Descripción persistida' } }
  const fetchStub = stubApi([{ method: 'PATCH', path: '/users/me', handler: () => ({ body: updated }) }, ...routes])
  renderProfile()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil profesional' }))
  const form = screen.getByRole('form', { name: 'Editar perfil profesional' })
  fireEvent.change(within(form).getByLabelText('Especialidad'), { target: { value: ' Nueva especialidad ' } })
  fireEvent.change(within(form).getByLabelText('Descripción'), { target: { value: ' Nueva descripción ' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Perfil profesional actualizado correctamente.')).toBeInTheDocument()
  expect(screen.getByText('Descripción persistida')).toBeInTheDocument()
  expect(requestsTo(fetchStub, 'PATCH', '/users/me')[0].body).toEqual({ specialty: 'Nueva especialidad', description: 'Nueva descripción' })
})
it('cancels professional edits without a request and resets the draft', async () => {
  const fetchStub = stubApi(routes); renderProfile()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil profesional' }))
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'Borrador' } })
  fireEvent.click(within(screen.getByRole('form', { name: 'Editar perfil profesional' })).getByRole('button', { name: 'Cancelar' }))
  expect(requestsTo(fetchStub, 'PATCH', '/users/me')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Editar perfil profesional' }))
  expect(screen.getByLabelText('Especialidad')).toHaveValue(profile.trainerProfile.specialty)
})
it('keeps the draft on server validation errors and validates whitespace', async () => {
  const fetchStub = stubApi([{ method: 'PATCH', path: '/users/me', handler: () => ({ status: 400, body: { message: 'Especialidad inválida' } }) }, ...routes]); renderProfile()
  fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil profesional' }))
  const form = screen.getByRole('form', { name: 'Editar perfil profesional' })
  expect(screen.getByLabelText('Especialidad')).toHaveAttribute('maxlength', '150')
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: ' ' } })
  fireEvent.submit(form)
  expect(await screen.findByRole('alert')).toHaveTextContent('Completá')
  expect(requestsTo(fetchStub, 'PATCH', '/users/me')).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'Borrador' } })
  fireEvent.submit(form)
  expect(await screen.findByText('Especialidad inválida')).toBeInTheDocument()
  expect(screen.getByLabelText('Especialidad')).toHaveValue('Borrador')
  expect(screen.getByText(profile.trainerProfile.specialty)).toBeInTheDocument()
})

it.each(['MEMBER', 'ADMIN'] as const)('does not expose professional editing for %s', async (role) => {
  stubApi([
    { path: '/users/me', handler: () => ({ body: { ...profile, role } }) },
    { path: '/members/me/membership', handler: () => ({ body: {} }) },
    { path: '/members/me/payments', handler: () => ({ body: { items: [], total: 0 } }) },
    { path: '/members/me/medical-certificates', handler: () => ({ body: { items: [], total: 0, page: 1, limit: 20, initialMedicalCertificatePeriod: { isActive: false } } }) },
  ])
  renderWithSession(<ProfileScreen role={role} onPasswordChange={vi.fn()} onLogout={vi.fn()}/>, { user: testUser(role) })
  await screen.findByLabelText('Correo electrónico')
  expect(screen.queryByRole('button', { name: 'Editar perfil profesional' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Especialidad')).not.toBeInTheDocument()
})

it('disables editing while the real update is pending', async () => {
  stubApi(routes)
  let resolveUpdate!: (value: OwnProfile) => void
  const update = vi.spyOn(backendApi, 'updateOwnProfile').mockImplementation(() => new Promise((resolve) => { resolveUpdate = resolve }))
  try {
    renderProfile()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil profesional' }))
    const form = screen.getByRole('form', { name: 'Editar perfil profesional' })
    fireEvent.submit(form)
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(within(form).getByRole('button', { name: /Guardando/ })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByLabelText('Especialidad')).toBeDisabled()
    resolveUpdate(profile)
    expect(await screen.findByText('Perfil profesional actualizado correctamente.')).toBeInTheDocument()
  } finally {
    update.mockRestore()
  }
})
