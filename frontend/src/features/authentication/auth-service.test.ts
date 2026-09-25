import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from './auth-service'
import { authStorage } from './auth-storage'
import type { LoginResponse } from './auth-types'

const loginResponse: LoginResponse = {
  accessToken: 'login-test-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: {
    id: 'member-id',
    firstName: 'Lara',
    lastName: 'Frenkel',
    email: 'lara@example.com',
    role: 'MEMBER',
    status: 'ACTIVE',
    isPasswordChangeRequired: false,
  },
}

describe('servicio de autenticación real', () => {
  beforeEach(() => {
    authStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    authStorage.clear()
    vi.unstubAllGlobals()
  })

  it('procesa un login correcto contra /auth/login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(loginResponse), { status: 200 }))
    await expect(authService.login({ email: 'lara@example.com', password: 'valid-password' })).resolves.toEqual(loginResponse)
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })

  it('propaga el mensaje seguro de un login incorrecto', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos', details: null }), { status: 401 }))
    await expect(authService.login({ email: 'lara@example.com', password: 'wrong-password' })).rejects.toMatchObject({
      status: 401,
      message: 'Correo o contraseña incorrectos',
    })
  })

  it('cierra la sesión en el backend mediante POST', async () => {
    authStorage.write(loginResponse, false)
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await authService.logout()
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })
})
