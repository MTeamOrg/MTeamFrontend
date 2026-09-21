export type UserRole = 'MEMBER' | 'TRAINER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'INACTIVE'

export interface AuthUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: UserRole
  status: UserStatus
  isPasswordChangeRequired: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: AuthUser
}

export interface RegisterInput {
  firstName: string
  lastName: string
  documentNumber: string
  birthDate: string
  email: string
  phone: string
  password: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface AuthSession extends LoginResponse {
  expiresAt: number
}
