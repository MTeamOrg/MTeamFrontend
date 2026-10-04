import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setMobileViewport } from '../../test/test-utils'
import { AdminBranchesScreen } from './AdminBranchesScreen'

describe('administración de sedes', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('muestra una sede desactivada y envía filtros reales al backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'branch-1', name: 'Sede Norte', imageUrl: '', address: 'Calle 1', openingHours: '08 a 22', phone: '111111', description: 'Sede de prueba', isActive: false, latitude: null, longitude: null }],
      page: 1,
      limit: 20,
      total: 1,
    }), { status: 200 })))
    render(<AdminBranchesScreen/>)
    expect((await screen.findAllByText('Sede Norte')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Desactivada').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Filtrar sedes por estado'), { target: { value: 'inactive' } })
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('isActive=false'), expect.anything()))
  })

  it('conserva los datos de imagen al abrir el editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'branch-2', name: 'Sede Sur', imageUrl: 'https://example.com/rota.jpg', address: 'Calle 2', openingHours: '08 a 22', phone: '222222', description: 'Sede', isActive: true, latitude: null, longitude: null }],
      page: 1,
      limit: 20,
      total: 1,
    }), { status: 200 })))
    render(<AdminBranchesScreen/>)
    expect((await screen.findAllByText('Sede Sur')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    expect(screen.getByRole('dialog', { name: 'Editar sede' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com/rota.jpg')).toBeInTheDocument()
  })

  it('muestra controles compactos y conserva acciones en celular', async () => {
    setMobileViewport(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'branch-3', name: 'Sede Centro', imageUrl: '', address: 'Calle 3', openingHours: '09 a 21', phone: '333333', description: 'Sede', isActive: true, latitude: null, longitude: null }],
      page: 1,
      limit: 20,
      total: 1,
    }), { status: 200 })))
    render(<AdminBranchesScreen/>)

    expect((await screen.findAllByText('Sede Centro')).length).toBeGreaterThan(0)
    expect(document.querySelector('.admin-branches-mobile-create')).toBeInTheDocument()
    expect(document.querySelector('.admin-branches-toolbar .search-shell input')).toBeInTheDocument()
    const filterToggle = screen.getByRole('button', { name: 'Mostrar filtros' })
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(filterToggle)
    expect(filterToggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.querySelector('.admin-branches-filter-fields')).toHaveClass('is-open')
    expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBeGreaterThan(0)
    fireEvent.click(document.querySelector('.admin-branches-mobile-create') as HTMLElement)
    expect(screen.getByRole('dialog', { name: 'Nueva sede' })).toBeInTheDocument()
  })
})
