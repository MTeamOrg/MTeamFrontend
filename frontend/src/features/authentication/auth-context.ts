import { createContext } from 'react'
import type { AuthSession, ChangePasswordInput, LoginCredentials } from './auth-types'

export interface AuthContextValue {
  session: AuthSession | null
  login: (credentials: LoginCredentials, remember: boolean) => Promise<AuthSession>
  logout: () => Promise<void>
  updateProfilePhoto: (photoUrl: string | null) => void
  changePassword: (input: ChangePasswordInput) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
