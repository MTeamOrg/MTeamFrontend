import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext } from '../features/authentication/auth-context'
import type { AuthUser, UserRole } from '../features/authentication/auth-types'

export function testUser(role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: `${role.toLowerCase()}-id`,
    firstName: role === 'ADMIN' ? 'Lara' : role === 'TRAINER' ? 'Tomás' : 'Sofía',
    lastName: 'Prueba',
    email: `${role.toLowerCase()}@example.com`,
    role,
    status: 'ACTIVE',
    isPasswordChangeRequired: false,
    ...overrides,
  }
}

export function renderWithSession(ui: ReactElement, { user, route = '/' }: { user: AuthUser; route?: string }) {
  const session = { accessToken: 'test-token', tokenType: 'Bearer' as const, expiresIn: 3600, expiresAt: Date.now() + 3_600_000, user }
  return render(<AuthContext.Provider value={{
    session,
    login: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    changePassword: vi.fn(),
  }}>
    <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
  </AuthContext.Provider>)
}

type Handler = (url: URL, init: RequestInit | undefined) => { status?: number; body?: unknown } | undefined

export interface ApiRoute {
  method?: string
  path: string | RegExp
  handler: Handler
}

// Routes the global fetch by method + pathname. A handler returning undefined defers to the
// next matching route; unmatched requests answer with an explicit failure.
export function stubApi(routes: ApiRoute[]) {
  const fetchStub = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.pathname.replace(/^\/api/, '')
    const result = routes
      .filter((item) => (item.method ?? 'GET') === method && (typeof item.path === 'string' ? item.path === path : item.path.test(path)))
      .reduce<ReturnType<Handler>>((found, item) => found ?? item.handler(url, init), undefined)
    if (!result) return Promise.resolve(new Response(JSON.stringify({ code: 'NOT_STUBBED', message: `${method} ${path} no stub`, details: null }), { status: 500 }))
    const status = result.status ?? 200
    return Promise.resolve(status === 204
      ? new Response(null, { status })
      : new Response(JSON.stringify(result.body ?? null), { status, headers: { 'Content-Type': 'application/json' } }))
  })
  vi.stubGlobal('fetch', fetchStub)
  return fetchStub
}

export function requestsTo(fetchStub: ReturnType<typeof stubApi>, method: string, path: string | RegExp) {
  return fetchStub.mock.calls.filter(([input, init]) => {
    const url = new URL(String(input))
    const pathname = url.pathname.replace(/^\/api/, '')
    return (init?.method ?? 'GET').toUpperCase() === method && (typeof path === 'string' ? pathname === path : path.test(pathname))
  }).map(([input, init]) => ({ url: new URL(String(input)), body: init?.body ? JSON.parse(String(init.body)) : undefined }))
}

export function setMobileViewport(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}
