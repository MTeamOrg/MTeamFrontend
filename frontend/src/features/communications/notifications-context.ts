import { createContext } from 'react'

/** How often an open workspace asks the server for new notifications while the tab is visible. */
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000

export interface NotificationsContextValue {
  /** Unread notifications of the signed-in account; null until the first answer (or when not applicable). */
  unreadCount: number | null
  /** Asks the server again, e.g. after reading notifications. */
  refreshUnreadCount: () => Promise<void>
  /** Lets the inbox share the account-wide counter that arrived with its own request. */
  syncUnreadCount: (value: number) => void
}

export const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: null,
  refreshUnreadCount: async () => undefined,
  syncUnreadCount: () => undefined,
})
