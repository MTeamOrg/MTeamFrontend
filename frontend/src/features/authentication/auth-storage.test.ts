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

  it('clears both browser storages', () => {
    authStorage.write(loginResponse, true)
    authStorage.clear()
    expect(authStorage.read()).toBeNull()
  })
})
