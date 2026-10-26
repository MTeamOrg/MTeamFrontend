import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requestsTo, stubApi } from '../../test/test-utils'
import { NotificationsProvider } from './NotificationsProvider'
import { NOTIFICATION_POLL_INTERVAL_MS } from './notifications-context'
import { useNotifications } from './use-notifications'

function Counter() {
  const { unreadCount } = useNotifications()
  return <p data-testid="counter">{unreadCount === null ? 'sin dato' : String(unreadCount)}</p>
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

function unreadAnswer(total: () => number) {
  return { path: '/notifications', handler: () => ({ body: { items: [], page: 1, limit: 1, total: total() } }) }
}

async function advance(milliseconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) })
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    setVisibility('visible')
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    setVisibility('visible')
  })

  it('asks for the account-wide unread total when it mounts', async () => {
    const fetchStub = stubApi([unreadAnswer(() => 4)])
    render(<NotificationsProvider enabled><Counter/></NotificationsProvider>)
    expect(screen.getByTestId('counter')).toHaveTextContent('sin dato')
    expect(await screen.findByText('4')).toBeInTheDocument()

    const [request] = requestsTo(fetchStub, 'GET', '/notifications')
    expect(request.url.searchParams.get('isRead')).toBe('false')
    expect(request.url.searchParams.get('limit')).toBe('1')
    expect(request.url.searchParams.get('page')).toBe('1')
  })

  it('picks up notifications that arrive while the app stays open and stops polling when it unmounts', async () => {
    let total = 1
    const fetchStub = stubApi([unreadAnswer(() => total)])
    const view = render(<NotificationsProvider enabled><Counter/></NotificationsProvider>)
    expect(await screen.findByText('1')).toBeInTheDocument()

    total = 3
    await advance(NOTIFICATION_POLL_INTERVAL_MS)
    expect(await screen.findByText('3')).toBeInTheDocument()

    view.unmount()
    const callsBefore = requestsTo(fetchStub, 'GET', '/notifications').length
    await advance(NOTIFICATION_POLL_INTERVAL_MS * 3)
    expect(requestsTo(fetchStub, 'GET', '/notifications')).toHaveLength(callsBefore)
  })

  it('does not poll while the tab is hidden and refreshes when the user comes back', async () => {
    let total = 2
    const fetchStub = stubApi([unreadAnswer(() => total)])
    render(<NotificationsProvider enabled><Counter/></NotificationsProvider>)
    expect(await screen.findByText('2')).toBeInTheDocument()

    setVisibility('hidden')
    total = 5
    await advance(NOTIFICATION_POLL_INTERVAL_MS * 2)
    expect(requestsTo(fetchStub, 'GET', '/notifications')).toHaveLength(1)
    expect(screen.getByTestId('counter')).toHaveTextContent('2')

    setVisibility('visible')
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(await screen.findByText('5')).toBeInTheDocument()
  })

  it('keeps the last known value when the server cannot be reached', async () => {
    let failing = false
    stubApi([{ path: '/notifications', handler: () => failing ? { status: 500, body: { message: 'caído' } } : { body: { items: [], page: 1, limit: 1, total: 6 } } }])
    render(<NotificationsProvider enabled><Counter/></NotificationsProvider>)
    expect(await screen.findByText('6')).toBeInTheDocument()

    failing = true
    await advance(NOTIFICATION_POLL_INTERVAL_MS)
    expect(screen.getByTestId('counter')).toHaveTextContent('6')
  })

  it('does not call the API for roles without notifications', async () => {
    const fetchStub = stubApi([unreadAnswer(() => 9)])
    render(<NotificationsProvider enabled={false}><Counter/></NotificationsProvider>)
    await advance(NOTIFICATION_POLL_INTERVAL_MS * 2)
    expect(fetchStub).not.toHaveBeenCalled()
    expect(screen.getByTestId('counter')).toHaveTextContent('sin dato')
  })

  it('never shows the previous account counter after the user changes', async () => {
    let total = 7
    stubApi([unreadAnswer(() => total)])
    const view = render(<NotificationsProvider key="first-account" enabled><Counter/></NotificationsProvider>)
    expect(await screen.findByText('7')).toBeInTheDocument()

    total = 1
    view.rerender(<NotificationsProvider key="second-account" enabled><Counter/></NotificationsProvider>)
    expect(screen.getByTestId('counter')).toHaveTextContent('sin dato')
    expect(await screen.findByText('1')).toBeInTheDocument()
  })

  it('lets the inbox share a fresher counter without waiting for the next poll', async () => {
    function Sync() {
      const { syncUnreadCount, refreshUnreadCount } = useNotifications()
      return <>
        <button type="button" onClick={() => syncUnreadCount(0)}>sincronizar</button>
        <button type="button" onClick={() => void refreshUnreadCount()}>consultar</button>
      </>
    }
    stubApi([unreadAnswer(() => 8)])
    render(<NotificationsProvider enabled><Counter/><Sync/></NotificationsProvider>)
    expect(await screen.findByText('8')).toBeInTheDocument()

    await act(async () => { screen.getByRole('button', { name: 'sincronizar' }).click() })
    expect(screen.getByTestId('counter')).toHaveTextContent('0')
    await act(async () => { screen.getByRole('button', { name: 'consultar' }).click() })
    expect(await screen.findByText('8')).toBeInTheDocument()
  })
})
