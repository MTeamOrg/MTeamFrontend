import { apiRequest } from '../../service/api-client'
import type { AuthUser, ChangePasswordInput, LoginCredentials, RegisterInput } from './auth-types'
import { parseAuthUser, parseLoginResponse } from './auth-validation'

function invalidAuthenticationResponse(): Error {
  return new Error('El servidor devolvió una respuesta de autenticación inválida.')
}

export const authService = {
  requestRecovery(email: string) {
    return apiRequest<{ message: string }>('/auth/password-recovery', { method: 'POST', body: { email }, authenticated: false })
  },
  completeRecovery(token: string, newPassword: string) {
    return apiRequest<void>('/auth/password-recovery/complete', { method: 'POST', body: { token, newPassword }, authenticated: false })
  },
  async login(credentials: LoginCredentials) {
    const response = await apiRequest<unknown>('/auth/login', { method: 'POST', body: credentials, authenticated: false })
    const safeResponse = parseLoginResponse(response)
    if (!safeResponse) throw invalidAuthenticationResponse()
    return safeResponse
  },
  register(input: RegisterInput) {
    return apiRequest<void>('/auth/register', { method: 'POST', body: input, authenticated: false })
  },
  logout() {
    return apiRequest<void>('/auth/logout', { method: 'POST' })
  },
  async currentIdentity(): Promise<AuthUser> {
    const identity = await apiRequest<unknown>('/auth/me')
    const safeIdentity = parseAuthUser(identity)
    if (!safeIdentity) throw invalidAuthenticationResponse()
    return safeIdentity
  },
  changePassword(input: ChangePasswordInput) {
    return apiRequest<void>('/auth/password', { method: 'PATCH', body: input })
  },
}
