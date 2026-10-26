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

  it('solicita recuperación sin enviar credenciales de sesión', async () => {
    authStorage.write(loginResponse, false)
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Si el correo corresponde a una cuenta activa, recibirás un enlace.' }), { status: 202 }))
    await authService.requestRecovery('persona@example.com')
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/auth/password-recovery')
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
    expect(JSON.parse(options?.body as string)).toEqual({ email: 'persona@example.com' })
  })

  it('propaga fallos de envío sin simular éxito', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'No pudimos enviar el correo.' }), { status: 503 }))
    await expect(authService.requestRecovery('persona@example.com')).rejects.toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' })
  })

  it('completa recuperación sin autenticación y sin devolver una sesión', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    await expect(authService.completeRecovery('a'.repeat(64), 'new-password')).resolves.toBeUndefined()
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/auth/password-recovery/complete')
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
    expect(JSON.parse(options?.body as string)).toEqual({ token: 'a'.repeat(64), newPassword: 'new-password' })
  })

  it('procesa un login correcto contra /auth/login', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(loginResponse), { status: 200 }))
    await expect(authService.login({ email: 'lara@example.com', password: 'valid-password' })).resolves.toEqual(loginResponse)
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/auth/login', expect.objectContaining({ method: 'POST' }))
  })

  it('rechaza respuestas de login con datos fuera de la allowlist', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ...loginResponse,
      user: { ...loginResponse.user, role: 'SUPER_ADMIN' },
    }), { status: 200 }))

    await expect(authService.login({ email: 'lara@example.com', password: 'valid-password' }))
      .rejects.toThrow('El servidor devolvió una respuesta de autenticación inválida.')
  })

  it('rechaza identidades incompletas o con un rol no permitido', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      ...loginResponse.user,
      role: 'SUPER_ADMIN',
    }), { status: 200 }))

    await expect(authService.currentIdentity())
      .rejects.toThrow('El servidor devolvió una respuesta de autenticación inválida.')
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
