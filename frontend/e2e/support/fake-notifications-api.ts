import type { Page, Route } from '@playwright/test'

export const PASSWORD = 'TestPassword123!'

export interface FakeUser {
  id: string
  email: string
  role: 'MEMBER' | 'TRAINER'
  firstName: string
  lastName: string
}

export interface FakeNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'MEMBERSHIP_PRICE_CHANGED' | 'MEMBERSHIP_EXPIRING' | 'MEMBERSHIP_EXPIRED' | 'MEDICAL_CERTIFICATE_REVIEWED' | 'CLASS_CHANGED' | 'EVENT_CANCELLED' | 'GENERAL'
  createdAt: string
  readAt: string | null
}

/**
 * In-memory stand-in for the M-Team API, scoped to authentication and notifications. It behaves like the
 * real contract (each token sees only its own notifications, newest first, `isRead` filter, pagination and
 * the account-wide `unreadCount`), so the browser tests exercise the screens without any backend.
 * It does NOT prove that the real backend and database work: see e2e/real-backend for that.
 */
export class FakeNotificationsApi {
  readonly listRequests: Array<{ userId: string | null; query: URLSearchParams }> = []
  failNextUnfilteredList = 0
  failNextReadStatus = 0
  private revokedUserIds = new Set<string>()
  private sequence = 0

  constructor(readonly users: FakeUser[], readonly notifications: FakeNotification[] = []) {}

  async install(page: Page) {
    await page.route('**/api/**', (route) => this.handle(route))
  }

  add(userId: string, title: string, overrides: Partial<FakeNotification> = {}): FakeNotification {
    this.sequence += 1
    const notification: FakeNotification = {
      id: `fake-notification-${this.sequence}`,
      userId,
      title,
      message: `Mensaje de ${title}`,
      type: 'GENERAL',
      createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0, 0) + this.sequence * 60_000).toISOString(),
      readAt: null,
      ...overrides,
    }
    this.notifications.push(notification)
    return notification
  }

  /** The next requests made with this account's token are answered 401, like an expired session. */
  revoke(userId: string) {
    this.revokedUserIds.add(userId)
  }

  unreadOf(userId: string) {
    return this.notifications.filter((item) => item.userId === userId && !item.readAt).length
  }

  private authenticatedUser(route: Route): FakeUser | 'revoked' | null {
    const token = route.request().headers()['authorization']?.replace(/^Bearer token-/, '')
    const user = this.users.find((candidate) => candidate.id === token)
    if (!user) return null
    return this.revokedUserIds.has(user.id) ? 'revoked' : user
  }

  private async handle(route: Route) {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method()

    if (method === 'POST' && path === '/auth/login') {
      const body = request.postDataJSON() as { email?: string; password?: string }
      const user = this.users.find((candidate) => candidate.email === body.email)
      if (!user || body.password !== PASSWORD) {
        return route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas', details: null } })
      }
      this.revokedUserIds.delete(user.id)
      return route.fulfill({
        status: 200,
        json: {
          accessToken: `token-${user.id}`,
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, status: 'ACTIVE', isPasswordChangeRequired: false },
        },
      })
    }

    const caller = this.authenticatedUser(route)
    if (path.startsWith('/auth/') || path.startsWith('/notifications')) {
      if (caller === null || caller === 'revoked') {
        return route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Se requiere una autenticación válida', details: null } })
      }
    }
    if (caller === null || caller === 'revoked') return route.abort()

    if (method === 'GET' && path === '/auth/me') {
      return route.fulfill({ status: 200, json: { ...caller, status: 'ACTIVE', isPasswordChangeRequired: false, photoUrl: null } })
    }
    if (method === 'POST' && path === '/auth/logout') return route.fulfill({ status: 204 })

    if (method === 'GET' && path === '/notifications') return this.list(route, caller, url.searchParams)
    if (method === 'PATCH' && path === '/notifications/read-status') return this.markRead(route, caller, null)
    const single = path.match(/^\/notifications\/([^/]+)\/read-status$/)
    if (method === 'PATCH' && single) return this.markRead(route, caller, single[1]!)

    // Everything else is out of scope for these tests and stays isolated from any real API.
    return route.abort()
  }

  private async list(route: Route, user: FakeUser, query: URLSearchParams) {
    this.listRequests.push({ userId: user.id, query })
    const filter = query.get('isRead')
    if (filter === null && this.failNextUnfilteredList > 0) {
      this.failNextUnfilteredList -= 1
      return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: null } })
    }
    const page = Number(query.get('page') ?? 1)
    const limit = Number(query.get('limit') ?? 20)
    const own = this.notifications
      .filter((item) => item.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    const filtered = own.filter((item) => filter === null || (filter === 'true' ? item.readAt : !item.readAt))
    return route.fulfill({
      status: 200,
      json: {
        items: filtered.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total: filtered.length,
        unreadCount: own.filter((item) => !item.readAt).length,
      },
    })
  }

  private async markRead(route: Route, user: FakeUser, notificationId: string | null) {
    if (this.failNextReadStatus > 0) {
      this.failNextReadStatus -= 1
      return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno', details: null } })
    }
    const own = this.notifications.filter((item) => item.userId === user.id && (notificationId === null || item.id === notificationId))
    if (notificationId !== null && own.length === 0) {
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'La notificación no existe', details: null } })
    }
    for (const item of own) item.readAt ??= new Date().toISOString()
    return route.fulfill({ status: 204 })
  }
}
