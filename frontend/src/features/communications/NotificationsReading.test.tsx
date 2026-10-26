import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Notification } from '../../service/backend-api'
import { renderWithSession, requestsTo, stubApi, testUser } from '../../test/test-utils'
import { NotificationsProvider } from './NotificationsProvider'
import { NotificationsScreen } from './NotificationsScreen'

const base = { userId: 'member-id', message: 'Mensaje', type: 'GENERAL' as const, createdAt: '2030-09-01T12:00:00.000Z' }
const unread = (id: string, title: string): Notification => ({ ...base, id, title, readAt: null })
const read = (id: string, title: string): Notification => ({ ...base, id, title, readAt: '2030-09-02T12:00:00.000Z' })

// 12:00 UTC is 09:00 in Buenos Aires; the server stores the read at 15:00 UTC, which is 12:00 there.
const SERVER_READ_AT = '2030-09-03T15:00:00.000Z'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A stateful stand-in for the real endpoints, so what the screen shows after each action can be checked. */
function backend(items: Notification[], options: { failReads?: number } = {}) {
  const state = { items: [...items], failures: options.failReads ?? 0 }
  const unreadCount = () => state.items.filter((item) => !item.readAt).length
  return stubApi([
    { path: '/notifications', handler: () => ({ body: { items: state.items, page: 1, limit: 20, total: state.items.length, unreadCount: unreadCount() } }) },
    {
      method: 'PATCH',
      path: /^\/notifications\/[^/]+\/read-status$/,
      handler: (url) => {
        if (state.failures > 0) {
          state.failures -= 1
          return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: null } }
        }
        const id = /\/notifications\/([^/]+)\/read-status$/.exec(url.pathname)?.[1]
        state.items = state.items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: SERVER_READ_AT } : item))
        return { status: 204 }
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/read-status',
      handler: () => {
        state.items = state.items.map((item) => (item.readAt ? item : { ...item, readAt: SERVER_READ_AT }))
        return { status: 204 }
      },
    },
  ])
}

const articleOf = async (title: string) => (await screen.findByRole('heading', { name: title })).closest('article') as HTMLElement

describe('opening a notification', () => {
  it('reads an unread notification and shows when it arrived and when it was read', async () => {
    const fetchStub = backend([unread('u1', 'Cuota próxima a vencer'), read('r1', 'Ya leída')])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const article = await articleOf('Cuota próxima a vencer')

    const toggle = within(article).getByRole('button', { name: 'Ver detalle' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    const detail = (await within(article).findByText('Recibida')).closest('dl') as HTMLElement
    expect(within(detail).getByText('01/09/2030 09:00')).toBeInTheDocument()
    expect(await within(detail).findByText('Leída el 03/09/2030 12:00')).toBeInTheDocument() // the server's value, not a local guess
    expect(within(article).getByRole('button', { name: 'Ocultar detalle' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(article).queryByRole('button', { name: 'Marcar como leída' })).not.toBeInTheDocument()
    expect(within(article).getByText('Leída')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'PATCH', /read-status$/)).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled()
  })

  it('keeps the explicit "Marcar como leída" control, and reading from it does not open the detail', async () => {
    const fetchStub = backend([unread('u1', 'Evento cancelado')])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const article = await articleOf('Evento cancelado')

    fireEvent.click(within(article).getByRole('button', { name: 'Marcar como leída' }))
    expect(await screen.findByText('Notificación marcada como leída.')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'PATCH', /read-status$/)).toHaveLength(1)
    expect(within(article).queryByText('Recibida')).not.toBeInTheDocument()
  })

  it('does not call the API to open a notification that was already read, and closing hides the detail', async () => {
    const fetchStub = backend([read('r1', 'Aviso anterior')])
    renderWithSession(<NotificationsScreen/>, { user: testUser('TRAINER') })
    const article = await articleOf('Aviso anterior')

    fireEvent.click(within(article).getByRole('button', { name: 'Ver detalle' }))
    expect(within(article).getByText('Leída el 02/09/2030 09:00')).toBeInTheDocument()
    fireEvent.click(within(article).getByRole('button', { name: 'Ocultar detalle' }))
    expect(within(article).queryByText('Recibida')).not.toBeInTheDocument()
    expect(within(article).getByRole('button', { name: 'Ver detalle' })).toHaveAttribute('aria-expanded', 'false')
    expect(requestsTo(fetchStub, 'PATCH', /read-status$/)).toHaveLength(0)
  })

  it('shows one detail at a time', async () => {
    backend([read('r1', 'Primero'), read('r2', 'Segundo')])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const first = await articleOf('Primero')
    const second = await articleOf('Segundo')

    fireEvent.click(within(first).getByRole('button', { name: 'Ver detalle' }))
    expect(within(first).getByText('Recibida')).toBeInTheDocument()
    fireEvent.click(within(second).getByRole('button', { name: 'Ver detalle' }))
    expect(within(second).getByText('Recibida')).toBeInTheDocument()
    expect(within(first).queryByText('Recibida')).not.toBeInTheDocument()
  })

  it('opens the detail even if reading fails, reports it without claiming success and retries', async () => {
    const fetchStub = backend([unread('u1', 'Apto médico rechazado')], { failReads: 1 })
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const article = await articleOf('Apto médico rechazado')

    fireEvent.click(within(article).getByRole('button', { name: 'Ver detalle' }))
    expect(await screen.findByText('No se pudo guardar el estado de lectura. Intentá nuevamente.')).toBeInTheDocument()
    expect(screen.queryByText('Notificación marcada como leída.')).not.toBeInTheDocument()
    expect(within(article).getByText('Todavía sin leer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Notificación marcada como leída.')).toBeInTheDocument()
    expect(await within(article).findByText('Leída el 03/09/2030 12:00')).toBeInTheDocument()
    expect(requestsTo(fetchStub, 'PATCH', /read-status$/)).toHaveLength(2)
  })

  it('closes the detail when the user changes page', async () => {
    stubApi([{ path: '/notifications', handler: (url) => {
      const second = url.searchParams.get('page') === '2'
      return { body: { items: [read(second ? 'p2' : 'p1', second ? 'De la segunda' : 'De la primera')], page: second ? 2 : 1, limit: 20, total: 40, unreadCount: 0 } }
    } }])
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const article = await articleOf('De la primera')
    fireEvent.click(within(article).getByRole('button', { name: 'Ver detalle' }))
    expect(within(article).getByText('Recibida')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    const next = await articleOf('De la segunda')
    expect(within(next).queryByText('Recibida')).not.toBeInTheDocument()
  })
})

describe('reading keeps the reader where they are', () => {
  it('keeps the same notification on screen (no reload of the list) and leaves the focus on it', async () => {
    backend(Array.from({ length: 15 }, (_, index) => unread(`u${index}`, `Aviso ${index}`)))
    renderWithSession(<NotificationsScreen/>, { user: testUser('MEMBER') })
    const article = await articleOf('Aviso 14')

    fireEvent.click(within(article).getByRole('button', { name: 'Marcar como leída' }))
    expect(await screen.findByText('Notificación marcada como leída.')).toBeInTheDocument()

    expect(screen.queryByText('Cargando notificaciones…')).not.toBeInTheDocument()
    expect(article.isConnected).toBe(true) // the list was not rebuilt, so the page keeps its scroll position
    expect(within(article).getByText('Leída')).toBeInTheDocument()
    expect(document.activeElement).toBe(within(article).getByRole('button', { name: 'Ver detalle' }))
    expect(screen.getAllByText('No leída')).toHaveLength(14)
  })

  it('marks everything as read without rebuilding the list and with nothing left unread', async () => {
    backend([unread('u1', 'Uno'), unread('u2', 'Dos')])
    renderWithSession(<NotificationsProvider enabled><NotificationsScreen/></NotificationsProvider>, { user: testUser('MEMBER') })
    const article = await articleOf('Uno')

    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))
    expect(await screen.findByText('Todas las notificaciones se marcaron como leídas.')).toBeInTheDocument()

    expect(article.isConnected).toBe(true)
    expect(screen.queryAllByText('No leída')).toHaveLength(0)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled())
  })
})
