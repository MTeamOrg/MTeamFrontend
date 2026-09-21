import { apiRequest } from '../../service/api-client'
import type { ChangePasswordInput, LoginCredentials, LoginResponse, RegisterInput } from './auth-types'

export const authService = {
  login(credentials: LoginCredentials) {
    return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials })
  },
  register(input: RegisterInput) {
    return apiRequest<void>('/auth/register', { method: 'POST', body: input })
  },
  logout(accessToken: string) {
    return apiRequest<void>('/auth/logout', { method: 'POST', accessToken })
  },
  changePassword(accessToken: string, input: ChangePasswordInput) {
    return apiRequest<void>('/auth/password', { method: 'PATCH', accessToken, body: input })
  },
}
