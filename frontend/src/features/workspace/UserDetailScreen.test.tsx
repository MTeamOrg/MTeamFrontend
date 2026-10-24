import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser, type ApiRoute } from '../../test/test-utils'
import type { AdminUserDetail } from '../../service/backend-api'
import { backendApi } from '../../service/backend-api'
import { UserDetailScreen } from './UserDetailScreen'

const temporaryPassword = 'AbCdEf0123456789_XyZ-abcdefghij0123456789abc'
const userDetail = {
  id: 'user-1',
  firstName: 'Ana',
  lastName: 'Lara',
  documentNumber: '30111222',
  birthDate: '1990-01-02',
  email: 'ana@example.com',
  phone: '1100000000',
  photoUrl: null,
  role: 'MEMBER' as const,
  status: 'ACTIVE' as const,
  isPasswordChangeRequired: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberProfile: { emergencyContactName: 'Contacto', emergencyContactPhone: '1100000001' },
  trainerProfile: null,
  membership: null,
  payments: [],
  medicalCertificates: [],
  trainerBranches: [],
  classes: [],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('UserDetailScreen password reset', () => {
  it('requests a server-generated temporary password and displays it once', async () => {
    const fetchStub = stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [], total: 0 } }) },
      { path: '/users/user-1', handler: () => ({ body: userDetail }) },
      { path: '/users/user-1/audit-logs', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) },
      { method: 'POST', path: '/users/user-1/password-resets', handler: () => ({ body: { temporaryPassword } }) },
    ])
    renderWithSession(<UserDetailScreen id="user-1" />, {
      user: testUser('ADMIN'),
      route: '/admin/usuarios/user-1',
    })

    fireEvent.click((await screen.findAllByRole('button', { name: /restablecer contraseña/i }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Generar contraseña temporal' }))

    expect(await screen.findByLabelText('Contraseña temporal generada')).toHaveValue(temporaryPassword)
    expect(fetchStub.mock.calls.some(([, init]) => init?.method === 'POST' && init.body === undefined)).toBe(true)
    expect(screen.queryByLabelText('Nueva contraseña temporal')).not.toBeInTheDocument()
  })
})

function setup(user: AdminUserDetail = userDetail, routes: ApiRoute[] = []) {
  const fetchStub = stubApi([{ path: '/access-attempts', handler: () => ({ body: { items: [], total: 0 } }) },
    ...routes,
    { path: '/users/user-1', handler: () => ({ body: user }) },
    { path: '/users/user-1/audit-logs', handler: () => ({ body: { items: [], total: 0 } }) },
    { path: '/admin/branches', handler: () => ({ body: { items: [{ id: 'branch-1', name: 'Centro' }], total: 1 } }) },
  ])
  renderWithSession(<UserDetailScreen id="user-1"/>, { user: testUser('ADMIN'), route: '/admin/usuarios/user-1?search=Ana' })
  return fetchStub
}

it('translates audit actions and keeps unknown events readable', async () => {
  setup({ ...userDetail, role: 'ADMIN' }, [{
    path: '/users/user-1/audit-logs',
    handler: () => ({ body: { items: [
      { id: 'audit-created', userId: 'user-1', action: 'CREATED', reason: null, occurredAt: '2026-09-02T17:10:00Z', performedBy: { id: 'admin-1', firstName: 'Operador', lastName: 'Sintético', email: 'operator@example.com', role: 'ADMIN' } },
      { id: 'audit-photo', userId: 'user-1', action: 'PROFILE_PHOTO_UPDATED', reason: 'Actualización de prueba', occurredAt: '2026-09-01T17:10:00Z', performedBy: { id: 'admin-1', firstName: 'Operador', lastName: 'Sintético', email: 'operator@example.com', role: 'ADMIN' } },
      { id: 'audit-unknown', userId: 'user-1', action: 'INTERNAL_EVENT', reason: null, occurredAt: '2026-08-30T17:10:00Z', performedBy: { id: 'admin-1', firstName: 'Operador', lastName: 'Sintético', email: 'operator@example.com', role: 'ADMIN' } },
    ], page: 1, limit: 10, total: 3 } }),
  }])

  expect(await screen.findByText('Cuenta creada')).toBeInTheDocument()
  expect(screen.getByText('Foto de perfil actualizada')).toBeInTheDocument()
  expect(screen.getByText('Acción registrada')).toBeInTheDocument()
  expect(screen.getByText('Motivo: Actualización de prueba')).toBeInTheDocument()
  expect(screen.queryByText('PROFILE_PHOTO_UPDATED')).not.toBeInTheDocument()
  expect(screen.queryByText('INTERNAL_EVENT')).not.toBeInTheDocument()
  expect(screen.getAllByText('Operador Sintético')).toHaveLength(3)
  expect(screen.getAllByRole('time')).toHaveLength(3)
})

async function openEditor() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Editar datos' }))[0])
  return within(screen.getByRole('dialog', { name: 'Editar datos' }))
}

describe('UserDetailScreen administrative editing', () => {
  it.each(['MEMBER', 'TRAINER', 'ADMIN'] as const)('edits supported fields for %s without sending role, status, photo or credentials', async (role) => {
    const user = { ...userDetail, role, trainerProfile: role === 'TRAINER' ? { specialty: 'Fuerza', description: 'Entrenamiento' } : null }
    const fetchStub = setup(user, [{ method: 'PATCH', path: '/users/user-1', handler: (_, init) => ({ body: { ...user, ...JSON.parse(String(init?.body)) } }) }])
    const editor = await openEditor()
    fireEvent.change(editor.getByLabelText('Nombre *'), { target: { value: '  Andrea  ' } })
    fireEvent.change(editor.getByLabelText('Documento *'), { target: { value: '40111222' } })
    fireEvent.change(editor.getByLabelText('Fecha de nacimiento *'), { target: { value: '1991-02-03' } })
    fireEvent.change(editor.getByLabelText('Motivo de la modificación (opcional)'), { target: { value: 'Corrección' } })
    if (role === 'MEMBER') fireEvent.change(editor.getByLabelText('Nombre del contacto'), { target: { value: '' } })
    if (role === 'TRAINER') fireEvent.change(editor.getByLabelText('Especialidad *'), { target: { value: 'Movilidad' } })
    expect(editor.queryByRole('tab')).not.toBeInTheDocument()
    fireEvent.click(editor.getByRole('button', { name: 'Guardar datos' }))
    expect(await screen.findByText('Datos actualizados correctamente.')).toBeInTheDocument()
    const body = requestsTo(fetchStub, 'PATCH', '/users/user-1')[0].body
    expect(body).toEqual({ firstName: 'Andrea', lastName: 'Lara', documentNumber: '40111222', birthDate: '1991-02-03', email: user.email, phone: user.phone, reason: 'Corrección', ...(role === 'MEMBER' ? { emergencyContactName: '', emergencyContactPhone: '1100000001' } : {}), ...(role === 'TRAINER' ? { specialty: 'Movilidad', description: 'Entrenamiento' } : {}) })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/users/user-1/audit-logs')).toHaveLength(2))
    expect(screen.getByRole('link', { name: /Volver a usuarios/ })).toHaveAttribute('href', '/admin/usuarios?search=Ana')
  })

  it.each([
    ['Nombre *', '   ', 'Completá todos los campos obligatorios.'],
    ['Correo electrónico *', 'invalid', 'Ingresá un correo electrónico válido.'],
    ['Correo electrónico *', 'ana@@example.com', 'Ingresá un correo electrónico válido.'],
    ['Correo electrónico *', 'ana@exa mple.com', 'Ingresá un correo electrónico válido.'],
    ['Correo electrónico *', 'ana@example.', 'Ingresá un correo electrónico válido.'],
    ['Documento *', 'ABC', 'El documento debe contener al menos un número.'],
    ['Fecha de nacimiento *', '2999-01-01', 'La fecha de nacimiento no puede ser futura.'],
  ])('validates %s before sending a request', async (label, value, message) => {
    const fetchStub = setup()
    const editor = await openEditor()
    fireEvent.change(editor.getByLabelText(label), { target: { value } })
    fireEvent.click(editor.getByRole('button', { name: 'Guardar datos' }))
    expect(await editor.findByRole('alert')).toHaveTextContent(message)
    expect(requestsTo(fetchStub, 'PATCH', '/users/user-1')).toHaveLength(0)
    expect(screen.queryByText('Datos actualizados correctamente.')).not.toBeInTheDocument()
  })

  it.each(['El documento ya está asociado a una cuenta', 'El correo electrónico ya está asociado a una cuenta', 'No se pudo conectar con el servidor.'])('preserves edits and allows retry after API error: %s', async (message) => {
    let hasFailed = false
    setup(userDetail, [{ method: 'PATCH', path: '/users/user-1', handler: () => {
      if (!hasFailed) { hasFailed = true; return { status: 409, body: { code: 'CONFLICT', message } } }
      return { body: { ...userDetail, firstName: 'Andrea' } }
    } }])
    const editor = await openEditor()
    fireEvent.change(editor.getByLabelText('Nombre *'), { target: { value: 'Andrea' } })
    fireEvent.click(editor.getByRole('button', { name: 'Guardar datos' }))
    expect(await editor.findByRole('alert')).toHaveTextContent(message)
    expect(editor.getByLabelText('Nombre *')).toHaveValue('Andrea')
    expect(screen.queryByText('Datos actualizados correctamente.')).not.toBeInTheDocument()
    fireEvent.click(editor.getByRole('button', { name: 'Guardar datos' }))
    expect(await screen.findByText('Datos actualizados correctamente.')).toBeInTheDocument()
  })

  it('saves trainer branches separately without discarding personal edits or existing assignments', async () => {
    const user: AdminUserDetail = { ...userDetail, role: 'TRAINER', trainerProfile: { specialty: 'Fuerza', description: 'Entrenamiento' }, trainerBranches: [{ id: 'inactive', name: 'Sede anterior', address: '' }] }
    const fetchStub = setup(user, [{ method: 'PUT', path: '/users/user-1/trainer-branches', handler: () => ({ body: user }) }])
    const editor = await openEditor()
    fireEvent.change(editor.getByLabelText('Nombre *'), { target: { value: 'Andrea' } })
    fireEvent.click(await editor.findByLabelText('Centro'))
    expect(editor.getByLabelText('Sede anterior')).toBeChecked()
    fireEvent.click(editor.getByRole('button', { name: 'Guardar sedes' }))
    expect(await editor.findByRole('status')).toHaveTextContent('Sedes actualizadas correctamente.')
    expect(editor.getByLabelText('Nombre *')).toHaveValue('Andrea')
    expect(requestsTo(fetchStub, 'PUT', '/users/user-1/trainer-branches')[0].body).toEqual({ branchIds: ['inactive', 'branch-1'] })
    expect(requestsTo(fetchStub, 'PATCH', '/users/user-1')).toHaveLength(0)
  })

  it.each(['ACTIVE', 'INACTIVE'] as const)('requires confirmation and sends an optional reason for status %s', async (status) => {
    const fetchStub = setup({ ...userDetail, status }, [{ method: 'PATCH', path: '/users/user-1/status', handler: () => ({ body: { ...userDetail, status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }) }])
    fireEvent.click((await screen.findAllByRole('button', { name: status === 'ACTIVE' ? 'Desactivar cuenta' : 'Reactivar cuenta' }))[0])
    expect(requestsTo(fetchStub, 'PATCH', '/users/user-1/status')).toHaveLength(0)
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Motivo (opcional)'), { target: { value: '  Solicitud del usuario  ' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Confirmar cambio de estado' }))
    expect(await screen.findByText('Estado de la cuenta actualizado.')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'PATCH', '/users/user-1/status')[0].body).toEqual({ status: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', reason: 'Solicitud del usuario' })
    expect(requestsTo(fetchStub, 'PATCH', '/users/user-1')).toHaveLength(0)
  })

  it('shows status rejection without success and allows cancellation', async () => {
    setup(userDetail, [{ method: 'PATCH', path: '/users/user-1/status', handler: () => ({ status: 500, body: { message: 'Error de estado' } }) }])
    fireEvent.click((await screen.findAllByRole('button', { name: 'Desactivar cuenta' }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio de estado' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de estado')
    expect(screen.queryByText('Estado de la cuenta actualizado.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows password reset rejection and permits retry without displaying credentials', async () => {
    setup(userDetail, [{ method: 'POST', path: '/users/user-1/password-resets', handler: () => ({ status: 503, body: { message: 'No se pudo generar la contraseña' } }) }])
    fireEvent.click((await screen.findAllByRole('button', { name: /Restablecer contraseña/ }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Generar contraseña temporal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo generar la contraseña')
    expect(screen.queryByLabelText('Contraseña temporal generada')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar contraseña temporal' })).toBeEnabled()
  })

  it('prevents duplicate submissions and dismissal while saving', async () => {
    setup()
    let completeSave!: (user: AdminUserDetail) => void
    const save = vi.spyOn(backendApi, 'updateUser').mockImplementation(() => new Promise((resolve) => { completeSave = resolve }))
    const editor = await openEditor()
    const form = editor.getByRole('button', { name: 'Guardar datos' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(save).toHaveBeenCalledTimes(1)
    expect(editor.getByLabelText('Nombre *')).toBeDisabled()
    expect(editor.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent.click(editor.getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    completeSave(userDetail)
    expect(await screen.findByText('Datos actualizados correctamente.')).toBeInTheDocument()
  })

  it('shows branch loading errors and permits retry before saving assignments', async () => {
    let hasFailed = false
    const user: AdminUserDetail = { ...userDetail, role: 'TRAINER', trainerProfile: { specialty: 'Fuerza', description: 'Entrenamiento' } }
    setup(user, [{ path: '/admin/branches', handler: () => {
      if (!hasFailed) { hasFailed = true; return { status: 503, body: { message: 'No se pudieron cargar las sedes' } } }
      return { body: { items: [], total: 0 } }
    } }])
    const editor = await openEditor()
    fireEvent.click(await editor.findByRole('button', { name: 'Reintentar' }))
    expect(await editor.findByRole('button', { name: 'Guardar sedes' })).toBeEnabled()
  })

  it('keeps branch selections on API rejection without displaying success', async () => {
    const user: AdminUserDetail = { ...userDetail, role: 'TRAINER', trainerProfile: { specialty: 'Fuerza', description: 'Entrenamiento' } }
    setup(user, [{ method: 'PUT', path: '/users/user-1/trainer-branches', handler: () => ({ status: 400, body: { message: 'Sede no disponible' } }) }])
    const editor = await openEditor()
    fireEvent.click(await editor.findByLabelText('Centro'))
    fireEvent.click(editor.getByRole('button', { name: 'Guardar sedes' }))
    expect(await editor.findByRole('alert')).toHaveTextContent('Sede no disponible')
    expect(editor.getByLabelText('Centro')).toBeChecked()
    expect(editor.queryByText(/Sedes actualizadas correctamente/)).not.toBeInTheDocument()
  })
})
