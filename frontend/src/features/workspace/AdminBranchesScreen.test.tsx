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

  it('reemplaza una imagen rota por el fallback del diseño', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'branch-2', name: 'Sede Sur', imageUrl: 'https://example.com/rota.jpg', address: 'Calle 2', openingHours: '08 a 22', phone: '222222', description: 'Sede', isActive: true, latitude: null, longitude: null }],
      page: 1,
      limit: 20,
      total: 1,
    }), { status: 200 })))
    render(<AdminBranchesScreen/>)
    const image = await screen.findByRole('img', { name: 'Sede Sede Sur' })
    expect(image.tagName).toBe('IMG')
    fireEvent.error(image)
    const fallback = screen.getByRole('img', { name: 'Sede Sede Sur' })
    expect(fallback.tagName).toBe('DIV')
    expect(fallback).toHaveClass('media-fallback')
  })
})
