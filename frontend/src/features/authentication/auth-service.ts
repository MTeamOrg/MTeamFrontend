import { apiRequest } from '../../service/api-client'
import type { OwnProfile } from '../../service/backend-api'
import type { ChangePasswordInput, LoginCredentials, LoginResponse, RegisterInput } from './auth-types'

export const authService = {
  login(credentials: LoginCredentials) {
    return apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: credentials, authenticated: false })
  },
  register(input: RegisterInput) {
    return apiRequest<void>('/auth/register', { method: 'POST', body: input, authenticated: false })
  },
  logout() {
    return apiRequest<void>('/auth/logout', { method: 'POST' })
  },
  currentIdentity() {
    return apiRequest<OwnProfile>('/auth/me')
  },
  changePassword(input: ChangePasswordInput) {
    return apiRequest<void>('/auth/password', { method: 'PATCH', body: input })
  },
}
