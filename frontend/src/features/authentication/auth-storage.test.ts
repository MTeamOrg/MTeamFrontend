import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage } from './auth-storage'
import type { LoginResponse } from './auth-types'

const loginResponse: LoginResponse = {
  accessToken: 'token', tokenType: 'Bearer', expiresIn: 3600,
  user: {
    id: 'user-id', firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com',
    role: 'MEMBER', status: 'ACTIVE', isPasswordChangeRequired: false,
  },
}

describe('authStorage', () => {
  beforeEach(() => authStorage.clear())

  it('persists remembered sessions in local storage', () => {
    authStorage.write(loginResponse, true)
    expect(authStorage.read()?.accessToken).toBe('token')
    expect(localStorage.length).toBe(1)
    expect(sessionStorage.length).toBe(0)
  })

  it('stores non-remembered sessions temporarily', () => {
    authStorage.write(loginResponse, false)
    expect(authStorage.read()?.user.email).toBe('ana@example.com')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(1)
  })

  it('rejects a login response with a role outside the allowlist', () => {
    const poisonedResponse = {
      ...loginResponse,
      user: { ...loginResponse.user, role: 'SUPER_ADMIN' },
    }

    expect(() => authStorage.write(poisonedResponse as unknown as LoginResponse, true))
      .toThrow('El servidor devolvió una respuesta de autenticación inválida.')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('validates and reconstructs sessions read from browser storage', () => {
    const poisonedSession = {
      ...loginResponse,
      expiresAt: Date.now() + 60_000,
      user: { ...loginResponse.user, isAdmin: true },
      injected: '<script>alert(1)</script>',
    }
    localStorage.setItem('mteam.auth', JSON.stringify(poisonedSession))

    const session = authStorage.read()
    expect(session).not.toBeNull()
    expect(session).not.toHaveProperty('injected')
    expect(session?.user).not.toHaveProperty('isAdmin')
  })

  it('removes a stored session with an invalid role', () => {
    const poisonedSession = {
      ...loginResponse,
      expiresAt: Date.now() + 60_000,
      user: { ...loginResponse.user, role: 'SUPER_ADMIN' },
    }
    localStorage.setItem('mteam.auth', JSON.stringify(poisonedSession))

    expect(authStorage.read()).toBeNull()
    expect(localStorage.getItem('mteam.auth')).toBeNull()
  })

  it('ignores invalid session updates without overwriting the valid session', () => {
    const session = authStorage.write(loginResponse, true)
    const invalidSession = {
      ...session,
      user: { ...session.user, status: 'SUSPENDED' },
    }

    expect(authStorage.update(invalidSession as typeof session)).toBeNull()
    expect(authStorage.read()?.user.status).toBe('ACTIVE')
  })

  it('does not persist session updates containing markup in user-controlled fields', () => {
    const session = authStorage.write(loginResponse, true)
    const poisonedSession = {
      ...session,
      user: { ...session.user, firstName: '<script>alert(1)</script>' },
    }

    expect(authStorage.update(poisonedSession as typeof session)).toBeNull()
    expect(authStorage.read()?.user.firstName).toBe('Ana')
  })

  it('clears both browser storages', () => {
    authStorage.write(loginResponse, true)
    authStorage.clear()
    expect(authStorage.read()).toBeNull()
  })
})
