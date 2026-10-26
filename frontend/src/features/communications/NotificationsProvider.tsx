import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { backendApi } from '../../service/backend-api'
import { NOTIFICATION_POLL_INTERVAL_MS, NotificationsContext } from './notifications-context'

const RETURN_REFRESH_MIN_GAP_MS = 5_000

/**
 * Keeps the unread counter of the signed-in account fresh while the app stays open: it asks the API
 * when the workspace opens, every minute while the tab is visible, and when the user comes back to
 * the tab. Mount it with `key={user.id}` so a different account never inherits the previous counter.
 */
export function NotificationsProvider({ enabled, children }: PropsWithChildren<{ enabled: boolean }>) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const requestId = useRef(0)
  const lastRequestAt = useRef(0)

  const refreshUnreadCount = useCallback(async () => {
    const currentRequest = ++requestId.current
    lastRequestAt.current = Date.now()
    try {
      // `total` of the unread filter is the account-wide counter on every backend version.
      const page = await backendApi.listNotifications({ page: 1, limit: 1, isRead: false })
      if (currentRequest === requestId.current) setUnreadCount(page.total)
    } catch {
      // Keep the last known value; the inbox itself reports loading problems.
    }
  }, [])

  const syncUnreadCount = useCallback((value: number) => {
    requestId.current += 1 // a request that started earlier must not overwrite this fresher value
    setUnreadCount(value)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const start = window.setTimeout(() => { void refreshUnreadCount() }, 0)
    const isVisible = () => document.visibilityState === 'visible'
    const poll = () => { if (isVisible()) void refreshUnreadCount() }
    const refreshOnReturn = () => {
      if (isVisible() && Date.now() - lastRequestAt.current >= RETURN_REFRESH_MIN_GAP_MS) void refreshUnreadCount()
    }
    const interval = window.setInterval(poll, NOTIFICATION_POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshOnReturn)
    window.addEventListener('focus', refreshOnReturn)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshOnReturn)
      window.removeEventListener('focus', refreshOnReturn)
    }
  }, [enabled, refreshUnreadCount])

  const value = useMemo(() => ({
    unreadCount: enabled ? unreadCount : null,
    refreshUnreadCount,
    syncUnreadCount,
  }), [enabled, unreadCount, refreshUnreadCount, syncUnreadCount])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
