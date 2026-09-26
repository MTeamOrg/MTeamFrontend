import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { RoleWorkspace } from './RoleWorkspace'

function renderWorkspace(route: string, role: 'MEMBER' | 'TRAINER' | 'ADMIN', sessionRole = role) {
  return renderWithSession(<Routes>
    <Route path="/socio/*" element={<RoleWorkspace role="MEMBER"/>}/>
    <Route path="/entrenador/*" element={<RoleWorkspace role="TRAINER"/>}/>
    <Route path="/admin/*" element={<RoleWorkspace role="ADMIN"/>}/>
    <Route path="/iniciar-sesion" element={<p>Pantalla de ingreso</p>}/>
  </Routes>, { user: testUser(sessionRole), route })
}

function sidebarLabels() {
  const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
  return within(sidebar).getAllByRole('link').map((link) => link.textContent)
}

describe('shell autenticado', () => {
  beforeEach(() => {
    setMobileViewport(false)
    stubApi([])
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('usa la navegación lateral del Figma para cada rol', () => {
    renderWorkspace('/socio/eventos', 'MEMBER')
    expect(sidebarLabels()).toEqual(['Inicio', 'Mi perfil', 'Apto médico', 'Acceso QR', 'Clases', 'Eventos', 'Novedades', 'Notificaciones'])
    cleanup()
    renderWorkspace('/entrenador/eventos', 'TRAINER')
    expect(sidebarLabels()).toEqual(['Inicio', 'Mi perfil', 'Mis clases', 'Acceso QR', 'Eventos', 'Novedades', 'Notificaciones'])
    cleanup()
    renderWorkspace('/admin/eventos', 'ADMIN')
    expect(sidebarLabels()).toEqual(['Panel', 'Usuarios', 'Pagos y cuota', 'Aptos médicos', 'Accesos', 'Clases', 'Sedes', 'Eventos', 'Novedades'])
  })

  it('marca la sección activa, muestra el usuario y no agrega topbar de breadcrumbs', () => {
    renderWorkspace('/admin/novedades', 'ADMIN')
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(sidebar).getByRole('link', { name: 'Novedades' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Lara Prueba')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Novedades no disponible')).toBeInTheDocument()
    expect(document.querySelector('.breadcrumbs')).toBeNull()
  })

  it('la barra inferior mobile tiene cinco pestañas por rol', () => {
    setMobileViewport(true)
    renderWorkspace('/admin/eventos', 'ADMIN')
    const tabbar = screen.getByRole('navigation', { name: 'Navegación inferior' })
    expect(within(tabbar).getAllByRole('link').map((link) => link.textContent)).toEqual(['Panel', 'Usuarios', 'Pagos', 'Aptos', 'Clases'])
    expect(document.querySelector('.app-topbar-title')).toHaveTextContent('Eventos')
    expect(document.querySelector('.app-topbar')!.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('el panel admin mobile muestra la topbar "Panel" sin botón de cerrar sesión', async () => {
    setMobileViewport(true)
    stubApi([
      { path: '/users', handler: () => ({ body: { items: [], page: 1, limit: 1, total: 3 } }) },
      { path: '/members', handler: () => ({ body: { items: [], page: 1, limit: 1, total: 1 } }) },
    ])
    renderWorkspace('/admin', 'ADMIN')
    const topbar = document.querySelector('.app-topbar')!
    expect(within(topbar as HTMLElement).getByRole('heading', { name: 'Panel' })).toBeInTheDocument()
    expect(topbar.querySelectorAll('button, a')).toHaveLength(0)
    expect(within(screen.getByRole('navigation', { name: 'Navegación inferior' })).getByRole('link', { name: 'Panel' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText('Historial de accesos no disponible')).toBeInTheDocument()
  })

  it('socio y entrenador usan el orden de la navegación lateral en las pestañas mobile', () => {
    setMobileViewport(true)
    renderWorkspace('/socio/eventos', 'MEMBER')
    const tabs = () => within(screen.getByRole('navigation', { name: 'Navegación inferior' })).getAllByRole('link').map((link) => link.textContent)
    expect(tabs()).toEqual(['Inicio', 'Mi perfil', 'Apto', 'Acceso QR', 'Clases'])
    cleanup()
    renderWorkspace('/entrenador/eventos', 'TRAINER')
    expect(tabs()).toEqual(['Inicio', 'Mi perfil', 'Mis clases', 'Acceso QR', 'Eventos'])
  })

  it('mantiene accesibles pagos y entrenadores del socio dentro de Inicio', () => {
    stubApi([
      { path: '/members/me/membership', handler: () => ({ body: { currentPrice: null, lastPaymentAt: null, expiresAt: null, daysRemaining: 0, status: 'EXPIRED' } }) },
      { path: '/members/me/payments', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) },
    ])
    renderWorkspace('/socio/pagos', 'MEMBER')
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(sidebar).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
    expect(document.querySelector('.app-topbar-title')).toHaveTextContent('Mis pagos')
  })

  it('redirige cuando el rol de la sesión no coincide', async () => {
    stubApi([{ path: '/weekly-schedules', handler: () => ({ body: { id: null, weekStartsOn: '2026-09-07', classes: [] } }) }])
    renderWorkspace('/admin/usuarios', 'ADMIN', 'TRAINER')
    await waitFor(() => expect(screen.getByText('Tomás Prueba')).toBeInTheDocument())
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(sidebar).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('cerrar sesión vuelve al ingreso', async () => {
    renderWorkspace('/socio/eventos', 'MEMBER')
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0])
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })
})
