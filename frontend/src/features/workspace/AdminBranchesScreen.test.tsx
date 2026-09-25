import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminBranchesScreen } from './AdminBranchesScreen'

describe('administración de sedes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('muestra una sede desactivada y envía filtros reales al backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'branch-1', name: 'Sede Norte', imageUrl: '', address: 'Calle 1', openingHours: '08 a 22', phone: '111111', description: 'Sede de prueba', isActive: false, latitude: null, longitude: null }],
      page: 1,
      limit: 20,
      total: 1,
    }), { status: 200 })))
    render(<AdminBranchesScreen/>)
    expect(await screen.findByText('Sede Norte')).toBeInTheDocument()
    expect(screen.getByText('Desactivada')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Filtrar sedes por estado'), { target: { value: 'inactive' } })
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('isActive=false'), expect.anything()))
  })
})
