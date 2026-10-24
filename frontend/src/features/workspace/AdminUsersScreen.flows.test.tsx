import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { AdminUsersScreen } from './AdminUsersScreen'

const newUser = { id: 'created-user', firstName: 'Ana', lastName: 'Gómez', documentNumber: '40123456', email: 'ana@example.com', role: 'MEMBER', status: 'ACTIVE' }
const userPage = (items: typeof newUser[] = [newUser], total = items.length) => ({ items, page: 1, limit: 20, total })

function renderUsers(route = '/admin/usuarios') {
  return renderWithSession(<Routes><Route path="/admin/usuarios/*" element={<AdminUsersScreen/>}/></Routes>, { user: testUser('ADMIN'), route })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AdminUsersScreen: flujos de gestión', () => {
  it('muestra vacío y permite reintentar un error de carga', async () => {
    let failed = false
    stubApi([{ path: '/users', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudieron cargar usuarios.' } } }
      return { body: userPage([]) }
    } }])
    renderUsers()

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay usuarios que coincidan con los filtros.')).toBeInTheDocument()
  })

  it('envía todos los filtros y reinicia la página al cambiar cualquiera', async () => {
    const fetchStub = stubApi([{ path: '/users', handler: (url) => ({ body: {
      items: [{ ...newUser, id: `user-${url.searchParams.get('page')}`, firstName: `Persona ${url.searchParams.get('page')}` }],
      page: Number(url.searchParams.get('page') ?? 1), limit: 20, total: 40,
    } }) }])
    renderUsers('/admin/usuarios?page=2')
    expect((await screen.findAllByText(/Persona 2/)).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Filtrar por rol'), { target: { value: 'TRAINER' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'INACTIVE' } })
    fireEvent.change(screen.getByLabelText('Filtrar por estado de cuota'), { target: { value: 'EXPIRED' } })
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: '  Ana  ' } })
    expect(screen.queryByText('Período inicial de 20 días')).not.toBeInTheDocument()

    await waitFor(() => {
      const lastRequest = requestsTo(fetchStub, 'GET', '/users').at(-1)?.url.searchParams
      expect(lastRequest?.get('role')).toBe('TRAINER')
      expect(lastRequest?.get('status')).toBe('INACTIVE')
      expect(lastRequest?.get('membershipStatus')).toBe('EXPIRED')
      expect(lastRequest?.has('initialPeriod')).toBe(false)
      expect(lastRequest?.get('search')).toBe('Ana')
      expect(lastRequest?.get('page')).toBe('1')
    })
  })

  it('abre y cierra el formulario, selecciona roles y conserva autocompletado por tipo', async () => {
    stubApi([{ path: '/users', handler: () => ({ body: userPage([]) }) }])
    renderUsers()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Crear cuenta' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'Crear cuenta' })
    expect(within(dialog).getByText('Las cuentas de entrenador y administrador solo se crean desde acá.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Socio' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Correo electrónico')).toHaveAttribute('autocomplete', 'email')
    expect(within(dialog).getByLabelText('Teléfono')).toHaveAttribute('autocomplete', 'tel')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrenador' }))
    expect(within(dialog).getByRole('button', { name: 'Entrenador' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByLabelText('Especialidad')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog', { name: 'Crear cuenta' })).not.toBeInTheDocument()
  })

  it('valida documento y campos obligatorios antes de crear la cuenta', async () => {
    const fetchStub = stubApi([{ path: '/users', handler: () => ({ body: userPage([]) }) }])
    renderUsers()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Crear cuenta' }))[0])
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Crear cuenta' })).toHaveAttribute('type', 'submit')
    const form = dialog.querySelector('form')!
    fireEvent.change(within(dialog).getByLabelText('Documento'), { target: { value: 'ABC' } })
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('Completá los campos obligatorios')
    expect(requestsTo(fetchStub, 'POST', '/users')).toHaveLength(0)

    for (const [label, value] of Object.entries({
      Apellido: 'Gómez', Documento: 'ABC', 'Fecha de nacimiento': '1990-01-02',
      'Correo electrónico': 'ana@example.com', Teléfono: '1122334455',
    })) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
    fireEvent.change(dialog.querySelector('input[type="password"]')!, { target: { value: 'ClaveSegura123' } })
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('El documento debe contener al menos un número.')
    expect(requestsTo(fetchStub, 'POST', '/users')).toHaveLength(0)
  })

  it('crea un socio con datos recortados y excluye campos opcionales vacíos', async () => {
    const fetchStub = stubApi([
      { path: '/users', handler: () => ({ body: userPage([]) }) },
      { method: 'POST', path: '/users', handler: () => ({ status: 201, body: newUser }) },
    ])
    renderUsers()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Crear cuenta' }))[0])
    const dialog = screen.getByRole('dialog')
    const form = dialog.querySelector('form')!
    for (const [label, value] of Object.entries({
      Nombre: ' Ana ', Apellido: ' Gómez ', Documento: ' 40123456 ', 'Fecha de nacimiento': '1990-01-02',
      'Correo electrónico': ' ana@example.com ', Teléfono: ' 1122334455 ',
    })) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
    fireEvent.change(dialog.querySelector('input[type="password"]')!, { target: { value: 'ClaveSegura123' } })
    fireEvent.submit(form)

    expect(await screen.findByText('No hay usuarios que coincidan con los filtros.')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'POST', '/users')[0]?.body).toEqual({
      firstName: 'Ana', lastName: 'Gómez', documentNumber: '40123456', birthDate: '1990-01-02',
      email: 'ana@example.com', phone: '1122334455', password: 'ClaveSegura123', role: 'MEMBER',
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('exige especialidad y descripción para entrenadores y comunica errores de validación del backend', async () => {
    const fetchStub = stubApi([
      { path: '/users', handler: () => ({ body: userPage([]) }) },
      { method: 'POST', path: '/users', handler: () => ({ status: 400, body: {
        code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: { fieldErrors: { email: ['Correo duplicado'] } },
      } }) },
    ])
    renderUsers()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Crear cuenta' }))[0])
    const dialog = screen.getByRole('dialog')
    const form = dialog.querySelector('form')!
    for (const [label, value] of Object.entries({
      Nombre: 'Tomás', Apellido: 'Pérez', Documento: '40123456', 'Fecha de nacimiento': '1990-01-02',
      'Correo electrónico': 'tomas@example.com', Teléfono: '1122334455',
    })) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })
    fireEvent.change(dialog.querySelector('input[type="password"]')!, { target: { value: 'ClaveSegura123' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrenador' }))
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('Completá los campos obligatorios: Especialidad, Descripción.')
    expect(requestsTo(fetchStub, 'POST', '/users')).toHaveLength(0)

    fireEvent.change(within(dialog).getByLabelText('Especialidad'), { target: { value: 'Musculación' } })
    fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Entrenador de sala' } })
    fireEvent.submit(form)
    expect(await screen.findByRole('alert')).toHaveTextContent('Datos inválidos. Revisá: Correo electrónico.')
    expect(requestsTo(fetchStub, 'POST', '/users')[0]?.body).toMatchObject({
      role: 'TRAINER', specialty: 'Musculación', description: 'Entrenador de sala',
    })
  })

  it('mantiene alineadas las columnas, reserva la acción y muestra cuota solo cuando llega en la respuesta', async () => {
    stubApi([
      { path: '/users', handler: () => ({ body: userPage([
        { id: 'long-user', firstName: 'Nombre de prueba extraordinariamente extenso', lastName: 'Apellido de prueba con muchos caracteres', documentNumber: 'DOCUMENTO-DE-PRUEBA-000000000000', email: 'correo-de-prueba-con-un-alias-muy-extenso@example.test', role: 'MEMBER', status: 'ACTIVE' },
        { id: 'trainer-user', firstName: 'Entrenador de prueba', lastName: 'Con apellido extenso', documentNumber: 'TRAINER-DOCUMENT-000000', email: 'trainer-with-a-long-email@example.test', role: 'TRAINER', status: 'INACTIVE' },
      ]) }) },
      { path: '/users/long-user', handler: () => ({ body: { photoUrl: null } }) },
      { path: '/users/trainer-user', handler: () => ({ body: { photoUrl: null } }) },
      { path: '/members', handler: () => ({ body: { items: [{ id: 'long-user', membershipStatus: 'EXPIRING_SOON' }], page: 1, limit: 1, total: 1 } }) },
    ])
    renderUsers()

    expect(await screen.findByRole('columnheader', { name: 'Usuario' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Usuario', 'Documento', 'Correo', 'Rol', 'Cuota', 'Estado', 'Acción'])
    expect((await screen.findAllByText('Próxima a vencer')).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Cuota no corresponde').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /Editar usuario Nombre de prueba/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('Nombre de prueba extraordinariamente extenso Apellido de prueba con muchos caracteres').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('correo-de-prueba-con-un-alias-muy-extenso@example.test').length).toBeGreaterThan(0)
    expect(screen.getByText('Mostrando 1–2 de 2 usuarios')).toBeInTheDocument()
  })

  it('muestra la foto real del detalle de usuario y conserva iniciales sin foto', async () => {
    const photoUser = { ...newUser, id: 'photo-user', firstName: 'Perfil', lastName: 'Disponible' }
    const initialsUser = { ...newUser, id: 'initials-user', firstName: 'Perfil', lastName: 'Ausente' }
    stubApi([
      { path: '/users', handler: () => ({ body: userPage([photoUser, initialsUser]) }) },
      { path: '/users/photo-user', handler: () => ({ body: { photoUrl: 'https://images.example.test/profile.jpg' } }) },
      { path: '/users/initials-user', handler: () => ({ body: { photoUrl: null } }) },
      { path: '/members', handler: (url) => ({ body: { items: [{ id: url.searchParams.get('search') === '40123456' ? 'photo-user' : 'initials-user', membershipStatus: 'CURRENT' }], page: 1, limit: 1, total: 1 } }) },
    ])
    renderUsers()

    expect((await screen.findAllByRole('img', { name: 'Foto de perfil de Perfil Disponible' }))[0]).toHaveAttribute('src', 'https://images.example.test/profile.jpg')
    expect((await screen.findAllByRole('img', { name: 'Iniciales de Perfil Ausente' })).length).toBeGreaterThan(0)
  })

  it('vuelve a las iniciales cuando falla la carga de la foto', async () => {
    const photoUser = { ...newUser, id: 'broken-photo-user', firstName: 'Perfil', lastName: 'Roto' }
    stubApi([
      { path: '/users', handler: () => ({ body: userPage([photoUser]) }) },
      { path: '/users/broken-photo-user', handler: () => ({ body: { photoUrl: 'https://images.example.test/broken.jpg' } }) },
      { path: '/members', handler: () => ({ body: { items: [{ id: 'broken-photo-user', membershipStatus: 'CURRENT' }], page: 1, limit: 1, total: 1 } }) },
    ])
    renderUsers()

    const image = (await screen.findAllByRole('img', { name: 'Foto de perfil de Perfil Roto' }))[0]
    fireEvent.error(image)
    expect((await screen.findAllByRole('img', { name: 'Iniciales de Perfil Roto' })).length).toBeGreaterThan(0)
  })

  it('conserva la paginación real del listado', async () => {
    const fetchStub = stubApi([{ path: '/users', handler: (url) => ({ body: {
      items: [{ ...newUser, id: `user-${url.searchParams.get('page') ?? '1'}`, firstName: `Persona página ${url.searchParams.get('page') ?? '1'}` }],
      page: Number(url.searchParams.get('page') ?? 1), limit: 1, total: 2,
    } }) }])
    renderUsers()

    expect(await screen.findByText('Mostrando 1–1 de 2 usuarios')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/users').at(-1)?.url.searchParams.get('page')).toBe('2'))
    expect(await screen.findByText('Mostrando 2–2 de 2 usuarios')).toBeInTheDocument()
  })
})
