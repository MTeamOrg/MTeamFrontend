import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicSite } from './PublicSite'

const branches = {
  items: [
    { id: 'branch-1', name: 'Belgrano', imageUrl: '', address: 'Av. Cabildo 100', openingHours: '08:00 a 22:00', phone: '11111111', description: 'Sede Belgrano' },
    { id: 'branch-2', name: 'Villa Urquiza', imageUrl: '', address: 'Triunvirato 200', openingHours: '08:00 a 22:00', phone: '22222222', description: 'Sede Villa Urquiza' },
  ],
  page: 1,
  limit: 100,
  total: 2,
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderPublicSite(path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={<PublicSite/>}/></Routes></MemoryRouter>)
}

describe('sitio público conectado al backend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(branches))))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('no muestra Sedes, Eventos ni Novedades en la navegación pública de escritorio ni celular', () => {
    renderPublicSite()
    const headerNavigation = within(screen.getByRole('navigation', { name: 'Navegación principal' }))
    expect(headerNavigation.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/')
    expect(headerNavigation.getByRole('link', { name: 'Preguntas frecuentes' })).toHaveAttribute('href', '/preguntas-frecuentes')
    expect(headerNavigation.queryByRole('link', { name: 'Sedes' })).not.toBeInTheDocument()
    expect(headerNavigation.queryByRole('link', { name: 'Eventos' })).not.toBeInTheDocument()
    expect(headerNavigation.queryByRole('link', { name: 'Novedades' })).not.toBeInTheDocument()

    const mobileNavigation = within(screen.getByRole('navigation', { name: 'Navegación' }))
    expect(mobileNavigation.queryByRole('link', { name: /Sedes/ })).not.toBeInTheDocument()
    expect(mobileNavigation.queryByRole('link', { name: /Eventos/ })).not.toBeInTheDocument()
    expect(mobileNavigation.queryByRole('link', { name: /Novedades/ })).not.toBeInTheDocument()
    expect(mobileNavigation.getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/')
  })

  it('abre preguntas frecuentes y marca su acceso activo en desktop y mobile', () => {
    renderPublicSite('/preguntas-frecuentes')
    expect(screen.getByRole('heading', { level: 1, name: 'Preguntas frecuentes' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Preguntas frecuentes' })).toHaveClass('active')
    expect(within(screen.getByRole('navigation', { name: 'Navegación' })).getByRole('link', { name: /Ayuda/ })).toHaveClass('selected')
  })

  it('carga las sedes reales y permite navegar al listado', async () => {
    renderPublicSite()
    expect(screen.getByRole('heading', { name: 'Entrená en M-TEAM' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Próximos eventos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Eventos no disponible' })).not.toBeInTheDocument()
    expect(await screen.findByText('Belgrano')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Ver las sedes/ }))
    expect(screen.getByRole('heading', { name: 'Sedes' })).toBeInTheDocument()
    expect(await screen.findByText('Villa Urquiza')).toBeInTheDocument()
  })

  it('muestra una respuesta vacía sin recurrir a sedes falsas', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...branches, items: [], total: 0 }))
    renderPublicSite('/sedes')
    expect(await screen.findByText('No hay sedes activas para mostrar.')).toBeInTheDocument()
  })

  it('muestra el error de red y permite reintentar', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(response(branches))
    renderPublicSite('/sedes')
    expect(await screen.findByText(/No se pudo conectar con el servidor/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0])
    expect(await screen.findByText('Belgrano')).toBeInTheDocument()
  })

  it('muestra el detalle real y una clase sin entrenador', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      ...branches.items[0],
      latitude: null,
      longitude: null,
      scheduledClasses: [{ id: 'class-1', activity: 'Yoga', startsAt: '2026-09-28T13:00:00.000Z', trainer: null }],
    }))
    renderPublicSite('/sedes/branch-1')
    expect(await screen.findByRole('heading', { level: 2, name: 'Belgrano' })).toBeInTheDocument()
    expect(screen.getByText(/Sin entrenador asignado/)).toBeInTheDocument()
  })

  it('deja eventos y novedades identificados como módulos pendientes', () => {
    const { unmount } = renderPublicSite('/eventos')
    expect(screen.getByRole('heading', { name: 'Eventos no disponible' })).toBeInTheDocument()
    unmount()
    renderPublicSite('/novedades')
    expect(screen.getByRole('heading', { name: 'Novedades no disponible' })).toBeInTheDocument()
  })
})
