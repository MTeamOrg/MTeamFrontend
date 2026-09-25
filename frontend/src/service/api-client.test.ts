import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authStorage } from '../features/authentication/auth-storage'
import type { LoginResponse } from '../features/authentication/auth-types'
import {
  apiRequest,
  AUTH_FORBIDDEN_EVENT,
  AUTH_UNAUTHORIZED_EVENT,
} from './api-client'

const login: LoginResponse = {
  accessToken: 'test-access-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: {
    id: 'user-id',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    role: 'MEMBER',
    status: 'ACTIVE',
    isPasswordChangeRequired: false,
  },
}

function response(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('cliente HTTP centralizado', () => {
  beforeEach(() => {
    authStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    authStorage.clear()
    vi.unstubAllGlobals()
  })

  it('adjunta la sesión persistida en pedidos autenticados', async () => {
    authStorage.write(login, true)
    vi.mocked(fetch).mockResolvedValue(response({ ok: true }))
    await apiRequest('/users/me')
    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer test-access-token')
  })

  it('no envía el token a endpoints declarados públicos', async () => {
    authStorage.write(login, true)
    vi.mocked(fetch).mockResolvedValue(response({ items: [] }))
    await apiRequest('/branches', { authenticated: false })
    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
  })

  it('limpia la sesión y notifica cuando el backend responde 401', async () => {
    authStorage.write(login, true)
    const listener = vi.fn()
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener)
    vi.mocked(fetch).mockResolvedValue(response({ code: 'UNAUTHORIZED', message: 'Sesión expirada', details: null }, 401))
    await expect(apiRequest('/users/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(authStorage.read()).toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener)
  })

  it('notifica permisos insuficientes sin cerrar una sesión válida', async () => {
    authStorage.write(login, false)
    const listener = vi.fn()
    window.addEventListener(AUTH_FORBIDDEN_EVENT, listener)
    vi.mocked(fetch).mockResolvedValue(response({ code: 'FORBIDDEN', message: 'No autorizado para esta operación', details: null }, 403))
    await expect(apiRequest('/users')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(authStorage.read()).not.toBeNull()
    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(AUTH_FORBIDDEN_EVENT, listener)
  })

  it('distingue un backend apagado de un error HTTP', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiRequest('/health')).rejects.toEqual(expect.objectContaining({
      status: 0,
      code: 'NETWORK_ERROR',
    }))
  })
})
