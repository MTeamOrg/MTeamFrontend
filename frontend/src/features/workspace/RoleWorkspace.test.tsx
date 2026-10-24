import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_FORBIDDEN_EVENT } from '../../service/api-client'
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

  it.each([['/socio/acceso', 'MEMBER'], ['/entrenador/acceso', 'TRAINER']] as const)('mantiene el acceso y la navegación activa en %s', (route, role) => {
    renderWorkspace(route, role)
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    const tabbar = screen.getByRole('navigation', { name: 'Navegación inferior' })
    expect(within(sidebar).getByRole('link', { name: 'Acceso QR' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabbar).getByRole('link', { name: 'Acceso' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabbar).getByRole('link', { name: 'Acceso' })).toHaveAttribute('href', route)
    expect(screen.getByRole('button', { name: 'Escanear QR' })).toBeInTheDocument()
  })

  it('usa la navegación lateral del Figma para cada rol', () => {
    renderWorkspace('/socio/eventos', 'MEMBER')
    expect(sidebarLabels()).toEqual(['Inicio', 'Mi perfil', 'Apto médico', 'Acceso QR', 'Clases', 'Eventos', 'Novedades', 'Notificaciones', 'Preguntas frecuentes'])
    cleanup()
    renderWorkspace('/entrenador/eventos', 'TRAINER')
    expect(sidebarLabels()).toEqual(['Inicio', 'Mi perfil', 'Mis clases', 'Acceso QR', 'Eventos', 'Novedades', 'Notificaciones', 'Preguntas frecuentes'])
    cleanup()
    renderWorkspace('/admin/eventos', 'ADMIN')
    expect(sidebarLabels()).toEqual(['Panel', 'Usuarios', 'Pagos y cuota', 'Aptos médicos', 'Accesos', 'Clases', 'Sedes', 'Eventos', 'Novedades', 'Preguntas frecuentes'])
  })

  it('marca la sección activa, muestra el usuario y no agrega topbar de breadcrumbs', () => {
    renderWorkspace('/admin/novedades', 'ADMIN')
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(sidebar).getByRole('link', { name: 'Novedades' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Lara Prueba')).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Novedades' })).toHaveLength(2)
    expect(document.querySelector('.breadcrumbs')).toBeNull()
  })

  it('la barra inferior mobile del administrador reserva espacio para sus secciones principales', () => {
    setMobileViewport(true)
    renderWorkspace('/admin/eventos', 'ADMIN')
    const tabbar = screen.getByRole('navigation', { name: 'Navegación inferior' })
    expect(within(tabbar).getAllByRole('link').map((link) => link.textContent)).toEqual(['Panel', 'Usuarios', 'Pagos', 'Aptos', 'Clases'])
    expect(within(tabbar).queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument()
    expect(document.querySelector('.app-topbar-title')).toHaveTextContent('Eventos')
    expect(document.querySelector('.app-topbar')!.querySelectorAll('button, a')).toHaveLength(1)
    expect(document.querySelector('.app-topbar')!.querySelector('a')).toHaveAttribute('href', '/admin')
  })

  it('el administrador puede cerrar sesión desde el panel en celular', async () => {
    setMobileViewport(true)
    renderWorkspace('/admin', 'ADMIN')
    const dashboard = document.querySelector('.dashboard-screen') as HTMLElement
    const logoutButton = within(dashboard).getByRole('button', { name: 'Cerrar sesión' })
    expect(logoutButton).toHaveClass('admin-mobile-logout', 'button-primary')
    fireEvent.click(logoutButton)
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })

  it('muestra volver al panel desde sedes en celular', () => {
    setMobileViewport(true)
    renderWorkspace('/admin/sedes', 'ADMIN')
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/admin')
  })

  it('muestra volver al panel desde accesos en celular', () => {
    setMobileViewport(true)
    stubApi([
      { path: '/access-attempts', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) },
      { path: '/admin/branches', handler: () => ({ body: { items: [], page: 1, limit: 100, total: 0 } }) },
    ])
    renderWorkspace('/admin/accesos', 'ADMIN')
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/admin')
    expect(document.querySelector('.app-topbar-title')).toHaveTextContent('Accesos')
  })

  it('abre preguntas frecuentes dentro del rol y marca ayuda como sección activa', () => {
    renderWorkspace('/socio/preguntas-frecuentes', 'MEMBER')
    expect(screen.getAllByRole('heading', { name: 'Preguntas frecuentes' }).length).toBeGreaterThan(0)
    const topbar = within(document.querySelector('.app-topbar') as HTMLElement)
    const helpLink = topbar.getByRole('link', { name: 'Preguntas frecuentes' })
    expect(helpLink).toHaveAttribute('href', '/socio/preguntas-frecuentes')
    expect(helpLink).toHaveAttribute('aria-current', 'page')
    expect(topbar.getByRole('link', { name: 'Notificaciones' })).toHaveAttribute('href', '/socio/notificaciones')
  })

  it('muestra y permite descartar el aviso de operación prohibida', () => {
    renderWorkspace('/socio', 'MEMBER')
    fireEvent(window, new Event(AUTH_FORBIDDEN_EVENT))
    const permissionAlert = screen.getByText(/No tenés permisos suficientes/).closest('[role="alert"]') as HTMLElement
    expect(permissionAlert).toBeInTheDocument()
    fireEvent.click(within(permissionAlert).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText(/No tenés permisos suficientes/)).not.toBeInTheDocument()
  })

  it('redirige rutas desconocidas al panel correspondiente al rol', async () => {
    renderWorkspace('/admin/seccion-inexistente', 'ADMIN')
    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Panel' })).toHaveAttribute('aria-current', 'page')
  })

  it('el panel admin mobile muestra el botón de cerrar sesión en Más secciones y no en la topbar', async () => {
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
    expect(await screen.findByRole('heading', { name: 'Últimos accesos' })).toBeInTheDocument()
    const moreSections = screen.getByRole('heading', { name: 'Más secciones' }).closest('section') as HTMLElement
    expect(within(moreSections).getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('admin-mobile-logout')
  })

  it('socio y entrenador usan el orden de la navegación lateral en las pestañas mobile', () => {
    setMobileViewport(true)
    renderWorkspace('/socio/eventos', 'MEMBER')
    const tabs = () => within(screen.getByRole('navigation', { name: 'Navegación inferior' })).getAllByRole('link').map((link) => link.textContent)
    expect(tabs()).toEqual(['Inicio', 'Mi perfil', 'Apto', 'Acceso', 'Clases'])
    cleanup()
    renderWorkspace('/entrenador/eventos', 'TRAINER')
    expect(tabs()).toEqual(['Inicio', 'Mi perfil', 'Mis clases', 'Acceso', 'Eventos'])
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
    await waitFor(() => expect(within(document.querySelector('.app-sidebar-user') as HTMLElement).getByText('Tomás Prueba')).toBeInTheDocument())
    const sidebar = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(sidebar).getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page')
  })

  it('cerrar sesión vuelve al ingreso', async () => {
    renderWorkspace('/socio/eventos', 'MEMBER')
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0])
    expect(await screen.findByText('Pantalla de ingreso')).toBeInTheDocument()
  })
})


describe.each([
  ['MEMBER', '/socio/notificaciones'], ['TRAINER', '/entrenador/notificaciones'],
] as const)('notification navigation for %s', (role, route) => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it.each([false, true])('uses the shared inbox with mobile=%s', async isMobile => {
    setMobileViewport(isMobile)
    stubApi([{ path: '/notifications', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWorkspace(route, role)
    expect(await screen.findByText('No ten\u00e9s notificaciones para mostrar.')).toBeInTheDocument()
    expect(screen.getByText('Avisos de tu cuenta y novedades operativas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todas como le\u00eddas' })).toBeDisabled()
  })
})
