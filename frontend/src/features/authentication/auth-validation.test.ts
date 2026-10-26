import { describe, expect, it } from 'vitest'
import { parseAuthSession, parseAuthUser, parseLoginResponse } from './auth-validation'

const validUser = {
  id: 'member-id',
  firstName: 'Lara',
  lastName: 'Frenkel',
  email: 'lara@example.com',
  role: 'MEMBER',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
  photoUrl: 'https://example.com/avatar.jpg',
}

const validLogin = {
  accessToken: 'test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: validUser,
}

describe('auth runtime validation', () => {
  describe('parseAuthUser', () => {
    it('accepts a valid user and returns only allowed fields', () => {
      const parsed = parseAuthUser({ ...validUser, isAdmin: true })

      expect(parsed).toEqual(validUser)
      expect(parsed).not.toHaveProperty('isAdmin')
    })

    it.each([
      null,
      [],
      { ...validUser, role: 'SUPER_ADMIN' },
      { ...validUser, status: 'SUSPENDED' },
      { ...validUser, email: 'not-an-email' },
      { ...validUser, email: 'name@-example.com' },
      { ...validUser, email: 'name..part@example.com' },
      { ...validUser, firstName: 'Lara\nAdmin' },
      { ...validUser, firstName: '<script>alert(1)</script>' },
      { ...validUser, id: 'user-id<script>' },
      { ...validUser, photoUrl: 'javascript:alert(1)' },
      { ...validUser, isPasswordChangeRequired: 'false' },
    ])('rejects malformed or disallowed user data', value => {
      expect(parseAuthUser(value)).toBeNull()
    })

    it('accepts a null photo URL', () => {
      expect(parseAuthUser({ ...validUser, photoUrl: null })?.photoUrl).toBeNull()
    })
  })

  describe('parseLoginResponse', () => {
    it('accepts a valid login response and removes unknown properties', () => {
      const parsed = parseLoginResponse({ ...validLogin, injected: 'not persisted' })

      expect(parsed).toEqual(validLogin)
      expect(parsed).not.toHaveProperty('injected')
    })

    it.each([
      { ...validLogin, accessToken: '' },
      { ...validLogin, accessToken: 'token with spaces' },
      { ...validLogin, accessToken: '<script>' },
      { ...validLogin, tokenType: 'Basic' },
      { ...validLogin, expiresIn: 0 },
      { ...validLogin, expiresIn: 1.5 },
      { ...validLogin, expiresIn: 60 * 60 * 24 * 366 },
      { ...validLogin, user: { ...validUser, role: 'OWNER' } },
    ])('rejects malformed login data', value => {
      expect(parseLoginResponse(value)).toBeNull()
    })
  })

  describe('parseAuthSession', () => {
    it('accepts a non-expired session and reconstructs its safe shape', () => {
      const parsed = parseAuthSession({
        ...validLogin,
        expiresAt: Date.now() + 60_000,
        injected: '<script>not stored</script>',
      })

      expect(parsed?.accessToken).toBe(validLogin.accessToken)
      expect(parsed?.user).toEqual(validUser)
      expect(parsed).not.toHaveProperty('injected')
    })

    it.each([
      { ...validLogin, expiresAt: Date.now() - 1 },
      { ...validLogin, expiresAt: Number.NaN },
      { ...validLogin, expiresAt: Date.now() + 366 * 24 * 60 * 60 * 1000 },
      { ...validLogin, expiresAt: Date.now() + 60_000, user: { ...validUser, status: 'SUSPENDED' } },
    ])('rejects expired or malformed session data', value => {
      expect(parseAuthSession(value)).toBeNull()
    })
  })
})
