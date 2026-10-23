import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestsTo, stubApi } from '../../test/test-utils'
import type { Branch } from '../../service/backend-api'
import { AdminBranchesScreen } from './AdminBranchesScreen'

const branch = (overrides: Partial<Branch> = {}): Branch => ({
  id: 'branch-1', name: 'Sede Belgrano', imageUrl: '', address: 'Calle 10', openingHours: '08 a 22',
  phone: '111111', description: 'Sede principal', isActive: true, latitude: null, longitude: null, ...overrides,
})

const page = (items: Branch[], total = items.length) => ({ items, page: 1, limit: 20, total })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AdminBranchesScreen: flujos de gestión', () => {
  it('muestra estado vacío y reintenta una carga fallida', async () => {
    let failed = false
    stubApi([{ path: '/admin/branches', handler: () => {
      if (!failed) { failed = true; return { status: 503, body: { message: 'No se pudieron cargar las sedes.' } } }
      return { body: page([]) }
    } }])
    render(<AdminBranchesScreen/>)

    expect(await screen.findByText('No se pudieron cargar las sedes.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay sedes que coincidan con los filtros.')).toBeInTheDocument()
  })

  it('envía búsqueda y filtro, vuelve a la página inicial y permite avanzar', async () => {
    const fetchStub = stubApi([{ path: '/admin/branches', handler: (url) => ({ body: {
      items: [branch({ id: `branch-${url.searchParams.get('page')}`, name: `Sede ${url.searchParams.get('page')}` })],
      page: Number(url.searchParams.get('page') ?? 1), limit: 20, total: 40,
    } }) }])
    render(<AdminBranchesScreen/>)
    expect((await screen.findAllByText('Sede 1')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect((await screen.findAllByText('Sede 2')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Buscar sedes'), { target: { value: 'Palermo' } })
    expect((await screen.findAllByText('Sede 1')).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Filtrar sedes por estado'), { target: { value: 'inactive' } })
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/admin/branches').at(-1)?.url.searchParams.toString()).toContain('isActive=false'))
    expect(requestsTo(fetchStub, 'GET', '/admin/branches').at(-1)?.url.searchParams.get('search')).toBe('Palermo')
    expect(requestsTo(fetchStub, 'GET', '/admin/branches').at(-1)?.url.searchParams.get('page')).toBe('1')
  })

  it('crea una sede con coordenadas numéricas y recarga el listado', async () => {
    let current = page([])
    const fetchStub = stubApi([
      { path: '/admin/branches', handler: () => ({ body: current }) },
      { method: 'POST', path: '/branches', handler: (_url, init) => {
        const created = branch(JSON.parse(String(init?.body)) as Partial<Branch>)
        current = page([created])
        return { status: 201, body: created }
      } },
    ])
    render(<AdminBranchesScreen/>)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nueva sede' }))[0])
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: ' Sede Palermo ' } })
    fireEvent.change(screen.getByLabelText('Dirección'), { target: { value: 'Calle 20' } })
    fireEvent.change(screen.getByLabelText('Horarios'), { target: { value: '09 a 21' } })
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '222222' } })
    fireEvent.change(screen.getByLabelText('URL de imagen'), { target: { value: 'https://example.com/sede.jpg' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Nueva sede' } })
    fireEvent.change(screen.getByLabelText('Latitud'), { target: { value: '-34.57' } })
    fireEvent.change(screen.getByLabelText('Longitud'), { target: { value: '-58.42' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sede' }))

    expect((await screen.findAllByText(/Sede Palermo/)).length).toBeGreaterThan(0)
    expect(requestsTo(fetchStub, 'POST', '/branches')[0]?.body).toEqual({
      name: ' Sede Palermo ', imageUrl: 'https://example.com/sede.jpg', address: 'Calle 20', openingHours: '09 a 21',
      phone: '222222', description: 'Nueva sede', latitude: -34.57, longitude: -58.42,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edita datos de una sede y muestra el error si el guardado falla', async () => {
    const fetchStub = stubApi([
      { path: '/admin/branches', handler: () => ({ body: page([branch({ imageUrl: 'https://example.com/branch.jpg' })]) }) },
      { method: 'PATCH', path: '/branches/branch-1', handler: () => ({ status: 400, body: { message: 'El teléfono no es válido.' } }) },
    ])
    render(<AdminBranchesScreen/>)
    const row = await screen.findByRole('row', { name: /Sede Belgrano/ })
    fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: 'inválido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sede' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El teléfono no es válido.')
    expect(requestsTo(fetchStub, 'PATCH', '/branches/branch-1')[0]?.body).toMatchObject({ phone: 'inválido' })
    expect(screen.getByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument()
  })

  it('requiere confirmar antes de desactivar/reactivar y refleja el estado actualizado', async () => {
    let current = branch()
    const fetchStub = stubApi([
      { path: '/admin/branches', handler: () => ({ body: page([current]) }) },
      { method: 'PATCH', path: '/branches/branch-1/status', handler: (_url, init) => {
        current = branch({ ...current, ...(JSON.parse(String(init?.body)) as Partial<Branch>) })
        return { body: current }
      } },
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AdminBranchesScreen/>)
    const row = await screen.findByRole('row', { name: /Sede Belgrano/ })
    fireEvent.click(within(row).getByRole('button', { name: 'Desactivar' }))
    expect(confirm).toHaveBeenCalledWith('¿Confirmás la desactivación de Sede Belgrano?')
    expect(requestsTo(fetchStub, 'PATCH', '/branches/branch-1/status')).toHaveLength(0)

    confirm.mockReturnValue(true)
    fireEvent.click(within(row).getByRole('button', { name: 'Desactivar' }))
    expect((await within(row).findAllByText('Desactivada')).length).toBeGreaterThan(0)
    expect(requestsTo(fetchStub, 'PATCH', '/branches/branch-1/status')[0]?.body).toEqual({ isActive: false })
  })
})
