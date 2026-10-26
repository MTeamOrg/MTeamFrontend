import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '../../service/backend-api'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { NotificationsProvider } from './NotificationsProvider'
import { NotificationsScreen } from './NotificationsScreen'
import { NOTIFICATION_POLL_INTERVAL_MS } from './notifications-context'

const base = { userId: 'member-id', message: 'Mensaje', type: 'GENERAL' as const, createdAt: '2030-09-01T12:00:00.000Z' }
const unread = (id: string, title: string): Notification => ({ ...base, id, title, readAt: null })
const read = (id: string, title: string): Notification => ({ ...base, id, title, readAt: '2030-09-02T12:00:00.000Z' })

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

function titles() {
  return screen.getAllByRole('article').map((item) => item.querySelector('h2')?.textContent)
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setVisibility('visible')
})

describe('mark all as read', () => {
  it('is available when the unread notifications are on other pages and disables itself once they are read', async () => {
    let unreadCount = 2
    const fetchStub = stubApi([
      { path: '/notifications', handler: () => ({ body: { items: [read('r1', 'Ya leída')], page: 1, limit: 20, total: 21, unreadCount } }) },
      { method: 'PATCH', path: '/notifications/read-status', handler: () => { unreadCount = 0; return { status: 204 } } },
    ])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })

    const markAll = await screen.findByRole('button', { name: 'Marcar todas como leídas' })
    await waitFor(() => expect(markAll).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'Marcar como leída' })).not.toBeInTheDocument()

    fireEvent.click(markAll)
    expect(await screen.findByText('Todas las notificaciones se marcaron como leídas.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled())
    expect(requestsTo(fetchStub, 'PATCH', '/notifications/read-status')).toHaveLength(1)
  })

  it('stays disabled when the account has nothing unread', async () => {
    stubApi([{ path: '/notifications', handler: () => ({ body: { items: [read('r1', 'Ya leída')], page: 1, limit: 20, total: 1, unreadCount: 0 } }) }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('TRAINER') })
    expect(await screen.findByText('Ya leída')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
  })

  it('uses the existing read filter when the unread tab is selected', async () => {
    const fetchStub = stubApi([{ path: '/notifications', handler: (url) => {
      const unreadOnly = url.searchParams.get('isRead') === 'false'
      const items = unreadOnly ? [unread('u1', 'Pendiente')] : [unread('u1', 'Pendiente'), read('r1', 'Ya leída')]
      return { body: { items, page: 1, limit: 20, total: items.length, unreadCount: 1 } }
    } }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })

    expect(await screen.findByText('Ya leída')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /No leídas/ }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/notifications').at(-1)?.url.searchParams.get('isRead')).toBe('false'))
    expect(await screen.findByText('Pendiente')).toBeInTheDocument()
    expect(screen.queryByText('Ya leída')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Todas' }))
    await waitFor(() => expect(requestsTo(fetchStub, 'GET', '/notifications').at(-1)?.url.searchParams.has('isRead')).toBe(false))
    expect(await screen.findByText('Ya leída')).toBeInTheDocument()
  })

  it('still works with a backend that does not report unreadCount, using the unread total', async () => {
    stubApi([{ path: '/notifications', handler: (url) => url.searchParams.get('isRead') === 'false'
      ? { body: { items: [unread('u1', 'Pendiente')], page: 1, limit: 1, total: 3 } }
      : { body: { items: [read('r1', 'Ya leída')], page: 1, limit: 20, total: 21 } } }])
    renderWithSession(<NotificationsProvider enabled><NotificationsScreen/></NotificationsProvider>, { user: testUser('MEMBER') })

    expect(await screen.findByText('Ya leída')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeEnabled())
  })

  it('reports a failure and retries without claiming success', async () => {
    let failing = true
    stubApi([
      { path: '/notifications', handler: () => ({ body: { items: [unread('u1', 'Pendiente')], page: 1, limit: 20, total: 1, unreadCount: 1 } }) },
      { method: 'PATCH', path: '/notifications/read-status', handler: () => { if (failing) { failing = false; return { status: 500 } } return { status: 204 } } },
    ])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const markAll = await screen.findByRole('button', { name: 'Marcar todas como leídas' })
    await waitFor(() => expect(markAll).toBeEnabled())
    fireEvent.click(markAll)

    expect(await screen.findByText('No se pudo guardar el estado de lectura. Intentá nuevamente.')).toBeInTheDocument()
    expect(screen.queryByText('Todas las notificaciones se marcaron como leídas.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Todas las notificaciones se marcaron como leídas.')).toBeInTheDocument()
  })
})

describe('pagination', () => {
  it('walks every page exactly once, newest first', async () => {
    const all = Array.from({ length: 45 }, (_, index) => read(`n-${index}`, `Aviso ${index}`))
    const fetchStub = stubApi([{ path: '/notifications', handler: (url) => {
      const page = Number(url.searchParams.get('page') ?? 1)
      const limit = Number(url.searchParams.get('limit') ?? 20)
      return { body: { items: all.slice((page - 1) * limit, page * limit), page, limit, total: all.length, unreadCount: 0 } }
    } }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })

    const seen: Array<string | null | undefined> = []
    expect(await screen.findByText('Aviso 0')).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    seen.push(...titles())

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Aviso 20')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
    seen.push(...titles())

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(await screen.findByText('Aviso 40')).toBeInTheDocument()
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    seen.push(...titles())

    expect(seen).toEqual(all.map((item) => item.title))
    expect(requestsTo(fetchStub, 'GET', '/notifications').map(({ url }) => url.searchParams.get('page'))).toEqual(['1', '2', '3'])

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(await screen.findByText('Aviso 20')).toBeInTheDocument()
  })

  it('does not show pagination when everything fits in one page', async () => {
    stubApi([{ path: '/notifications', handler: () => ({ body: { items: [read('r1', 'Única')], page: 1, limit: 20, total: 1, unreadCount: 0 } }) }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Única')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
  })
})

describe('notifications that arrive while the screen is open', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setVisibility('visible')
  })

  async function advance(milliseconds: number) {
    await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) })
  }

  it('adds them to the top of the list in the background, keeping the list on screen while it waits', async () => {
    const olderNotification = read('old', 'Aviso anterior')
    const answer = (items: Notification[]) => new Response(JSON.stringify({ items, page: 1, limit: 20, total: items.length, unreadCount: items.filter((item) => !item.readAt).length }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    let releaseBackgroundAnswer!: (response: Response) => void
    let requests = 0
    vi.stubGlobal('fetch', vi.fn(() => {
      requests += 1
      if (requests === 1) return Promise.resolve(answer([olderNotification]))
      return new Promise<Response>((resolve) => { releaseBackgroundAnswer = resolve })
    }))
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Aviso anterior')).toBeInTheDocument()

    await advance(NOTIFICATION_POLL_INTERVAL_MS)
    expect(requests).toBe(2)
    expect(screen.getByText('Aviso anterior')).toBeInTheDocument()
    expect(screen.queryByText('Cargando notificaciones…')).not.toBeInTheDocument()

    await act(async () => { releaseBackgroundAnswer(answer([unread('new', 'Aviso nuevo'), olderNotification])) })
    expect(await screen.findByText('Aviso nuevo')).toBeInTheDocument()
    expect(titles()).toEqual(['Aviso nuevo', 'Aviso anterior'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeEnabled())
  })

  it('keeps the list on screen when a background refresh fails', async () => {
    let failing = false
    stubApi([{ path: '/notifications', handler: () => failing
      ? { status: 500, body: { message: 'caído' } }
      : { body: { items: [unread('u1', 'Visible')], page: 1, limit: 20, total: 1, unreadCount: 1 } } }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Visible')).toBeInTheDocument()

    failing = true
    await advance(NOTIFICATION_POLL_INTERVAL_MS)
    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not refresh while the tab is hidden and refreshes when the user returns to it', async () => {
    let items = [read('old', 'Aviso anterior')]
    const fetchStub = stubApi([{ path: '/notifications', handler: () => ({ body: { items, page: 1, limit: 20, total: items.length, unreadCount: 0 } }) }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    expect(await screen.findByText('Aviso anterior')).toBeInTheDocument()
    const initialRequests = requestsTo(fetchStub, 'GET', '/notifications').length

    setVisibility('hidden')
    items = [read('new', 'Aviso nuevo'), ...items]
    await advance(NOTIFICATION_POLL_INTERVAL_MS * 2)
    expect(requestsTo(fetchStub, 'GET', '/notifications')).toHaveLength(initialRequests)
    expect(screen.queryByText('Aviso nuevo')).not.toBeInTheDocument()

    setVisibility('visible')
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(await screen.findByText('Aviso nuevo')).toBeInTheDocument()
  })
})

describe('what the member reads', () => {
  it('shows the Buenos Aires date, the type and the reading state of each notification', async () => {
    // 02:30 UTC on 2 September is still 1 September at 23:30 in Buenos Aires.
    const item = { ...unread('late', 'Clase asignada'), type: 'CLASS_CHANGED' as const, createdAt: '2030-09-02T02:30:00.000Z', message: 'Se te asignó la clase de Yoga.' }
    stubApi([{ path: '/notifications', handler: () => ({ body: { items: [item, read('old', 'Aviso anterior')], page: 1, limit: 20, total: 2, unreadCount: 1 } }) }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('TRAINER') })

    const article = (await screen.findByText('Clase asignada')).closest('article') as HTMLElement
    expect(within(article).getByRole('img', { name: 'Clases' })).toBeInTheDocument()
    expect(within(article).getByText('No leída')).toBeInTheDocument()
    expect(within(article).getByText('Se te asignó la clase de Yoga.')).toBeInTheDocument()
    const stamp = article.querySelector('time') as HTMLTimeElement
    expect(stamp.dateTime).toBe('2030-09-02T02:30:00.000Z')
    expect(stamp.textContent).toBe('01/09/2030 23:30')
  })

  it('explains a network failure and recovers when the user retries', async () => {
    let attempts = 0
    vi.stubGlobal('fetch', vi.fn(() => {
      attempts += 1
      if (attempts === 1) return Promise.reject(new TypeError('Failed to fetch'))
      return Promise.resolve(new Response(JSON.stringify({ items: [unread('u1', 'De nuevo')], page: 1, limit: 20, total: 1, unreadCount: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }))
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })

    expect(await screen.findByText('No se pudo conectar con el servidor. Revisá tu conexión a internet e intentá nuevamente.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('De nuevo')).toBeInTheDocument()
  })
})
