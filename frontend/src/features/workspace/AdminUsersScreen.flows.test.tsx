import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { AdminUsersScreen } from './AdminUsersScreen'

const newUser = { id: 'created-user', firstName: 'Ana', lastName: 'Gómez', documentNumber: '40123456', email: 'ana@example.com', role: 'MEMBER', status: 'ACTIVE' }
const userPage = (items = [newUser], total = items.length) => ({ items, page: 1, limit: 20, total })

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
    fireEvent.click(screen.getByLabelText('Período inicial de 20 días'))
    fireEvent.change(screen.getByLabelText('Buscar usuarios'), { target: { value: '  Ana  ' } })

    await waitFor(() => {
      const lastRequest = requestsTo(fetchStub, 'GET', '/users').at(-1)?.url.searchParams
      expect(lastRequest?.get('role')).toBe('TRAINER')
      expect(lastRequest?.get('status')).toBe('INACTIVE')
      expect(lastRequest?.get('membershipStatus')).toBe('EXPIRED')
      expect(lastRequest?.get('initialPeriod')).toBe('true')
      expect(lastRequest?.get('search')).toBe('Ana')
      expect(lastRequest?.get('page')).toBe('1')
    })
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
    fireEvent.change(within(dialog).getByLabelText('Rol'), { target: { value: 'TRAINER' } })
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
})
