import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithSession, requestsTo, setMobileViewport, stubApi, testUser } from '../../test/test-utils'
import { AuthContext } from '../authentication/auth-context'
import type { AuthUser } from '../authentication/auth-types'
import { RoleWorkspace } from './RoleWorkspace'

function renderWorkspace(route: string, role: 'MEMBER' | 'TRAINER' | 'ADMIN') {
  return renderWithSession(<Routes>
    <Route path="/socio/*" element={<RoleWorkspace role="MEMBER"/>}/>
    <Route path="/entrenador/*" element={<RoleWorkspace role="TRAINER"/>}/>
    <Route path="/admin/*" element={<RoleWorkspace role="ADMIN"/>}/>
  </Routes>, { user: testUser(role), route })
}

const sidebar = () => screen.getByRole('navigation', { name: 'Navegación principal' })
const topbar = () => document.querySelector('.app-topbar') as HTMLElement
const unreadTotal = (total: number) => ({ path: '/notifications', handler: () => ({ body: { items: [], page: 1, limit: 1, total } }) })

beforeEach(() => setMobileViewport(false))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('unread notifications counter in the workspace', () => {
  it.each([['MEMBER', '/socio'], ['TRAINER', '/entrenador']] as const)('shows the total on the menu entry and on the phone bell for %s', async (role, base) => {
    stubApi([unreadTotal(3)])
    renderWorkspace(`${base}/eventos`, role)

    const entry = await within(sidebar()).findByRole('link', { name: /Notificaciones.*3 notificaciones sin leer/ })
    expect(entry).toHaveAttribute('href', `${base}/notificaciones`)
    expect(entry.querySelector('.app-nav-badge')).toHaveTextContent('3')

    const bell = within(topbar()).getByRole('link', { name: /Notificaciones.*3 notificaciones sin leer/ })
    expect(bell).toHaveAttribute('href', `${base}/notificaciones`)
    expect(bell.querySelector('.app-nav-badge')).toHaveTextContent('3')
  })

  it('uses the singular for one notification and caps large totals', async () => {
    stubApi([unreadTotal(1)])
    renderWorkspace('/socio/eventos', 'MEMBER')
    expect(await within(sidebar()).findByRole('link', { name: /1 notificación sin leer/ })).toBeInTheDocument()
    cleanup()

    stubApi([unreadTotal(250)])
    renderWorkspace('/socio/eventos', 'MEMBER')
    const entry = await within(sidebar()).findByRole('link', { name: /250 notificaciones sin leer/ })
    expect(entry.querySelector('.app-nav-badge')).toHaveTextContent('99+')
  })

  it('shows no badge when there is nothing unread or the total is not known yet', async () => {
    const fetchStub = stubApi([unreadTotal(0)])
    renderWorkspace('/socio/eventos', 'MEMBER')
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/notifications').length).toBeGreaterThan(0))
    expect(document.querySelector('.app-nav-badge')).toBeNull()
    expect(within(sidebar()).getByRole('link', { name: 'Notificaciones' })).toBeInTheDocument()
  })

  it('has no notifications for administrators: no bell, no counter and no request', async () => {
    const fetchStub = stubApi([unreadTotal(7)])
    renderWorkspace('/admin/eventos', 'ADMIN')
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Eventos' }).length).toBeGreaterThan(0))
    expect(within(topbar()).getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/admin')
    expect(document.querySelector('.app-nav-badge')).toBeNull()
    expect(requestsTo(fetchStub, 'GET', '/notifications')).toHaveLength(0)
  })

  it('reaches the notifications from the phone bell, which the bottom tab bar cannot hold', async () => {
    setMobileViewport(true)
    stubApi([{ path: '/notifications', handler: () => ({ body: { items: [], page: 1, limit: 20, total: 0 } }) }])
    renderWorkspace('/socio/eventos', 'MEMBER')

    const tabs = within(screen.getByRole('navigation', { name: 'Navegación inferior' })).getAllByRole('link').map((link) => link.textContent)
    expect(tabs).not.toContain('Notificaciones')
    fireEvent.click(within(topbar()).getByRole('link', { name: 'Notificaciones' }))

    expect(await screen.findByText('No tenés notificaciones para mostrar.')).toBeInTheDocument()
    expect(within(topbar()).getByRole('link', { name: 'Notificaciones' })).toHaveAttribute('aria-current', 'page')
    expect(document.querySelector('.app-topbar-title')).toHaveTextContent('Notificaciones')
  })

  it('clears the counter once everything is marked as read', async () => {
    let unread = 2
    stubApi([
      { path: '/notifications', handler: (url) => url.searchParams.get('isRead') === 'false'
        ? { body: { items: [], page: 1, limit: 1, total: unread } }
        : { body: { items: [{ id: 'n1', userId: 'member-id', title: 'Aviso', message: 'Mensaje', type: 'GENERAL', createdAt: '2030-09-01T12:00:00.000Z', readAt: unread ? null : '2030-09-02T12:00:00.000Z' }], page: 1, limit: 20, total: 1, unreadCount: unread } } },
      { method: 'PATCH', path: '/notifications/read-status', handler: () => { unread = 0; return { status: 204 } } },
    ])
    renderWorkspace('/socio/notificaciones', 'MEMBER')

    expect(await within(sidebar()).findByRole('link', { name: /2 notificaciones sin leer/ })).toBeInTheDocument()
    const markAll = await screen.findByRole('button', { name: 'Marcar todas como leídas' })
    await waitFor(() => expect(markAll).toBeEnabled())
    fireEvent.click(markAll)
    expect(await screen.findByText('Todas las notificaciones se marcaron como leídas.')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.app-nav-badge')).toBeNull())
  })
})

describe('switching accounts', () => {
  it('never shows the counter of the previous account', async () => {
    const answers: Array<(response: Response) => void> = []
    const first = new Response(JSON.stringify({ items: [], page: 1, limit: 1, total: 5 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    let requests = 0
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (!new URL(String(input)).pathname.endsWith('/notifications')) return Promise.resolve(new Response('{}', { status: 404 }))
      requests += 1
      if (requests === 1) return Promise.resolve(first)
      return new Promise<Response>((resolve) => { answers.push(resolve) })
    }))
    const contextFor = (user: AuthUser) => ({
      session: { accessToken: 'test-token', tokenType: 'Bearer' as const, expiresIn: 3600, expiresAt: Date.now() + 3_600_000, user },
      login: vi.fn(), logout: vi.fn(() => Promise.resolve()), updateProfilePhoto: vi.fn(), changePassword: vi.fn(),
    })
    const tree = (user: AuthUser) => <AuthContext.Provider value={contextFor(user)}>
      <MemoryRouter initialEntries={['/socio/eventos']}>
        <Routes><Route path="/socio/*" element={<RoleWorkspace role="MEMBER"/>}/></Routes>
      </MemoryRouter>
    </AuthContext.Provider>

    const view = render(tree(testUser('MEMBER', { id: 'first-member' })))
    expect(await within(sidebar()).findByRole('link', { name: /5 notificaciones sin leer/ })).toBeInTheDocument()

    view.rerender(tree(testUser('MEMBER', { id: 'second-member' })))
    await waitFor(() => expect(answers).toHaveLength(1))
    expect(document.querySelector('.app-nav-badge')).toBeNull()
    expect(screen.queryByText(/5 notificaciones sin leer/)).not.toBeInTheDocument()

    await act(async () => { answers[0]!(new Response(JSON.stringify({ items: [], page: 1, limit: 1, total: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } })) })
    expect(await within(sidebar()).findByRole('link', { name: /1 notificación sin leer/ })).toBeInTheDocument()
  })
})
