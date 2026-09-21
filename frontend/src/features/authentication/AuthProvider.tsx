import { useMemo, useState, type PropsWithChildren } from 'react'
import { authService } from './auth-service'
import { authStorage } from './auth-storage'
import { AuthContext } from './auth-context'
import type { ChangePasswordInput, LoginCredentials } from './auth-types'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(authStorage.read)

  const value = useMemo(() => ({
    session,
    async login(credentials: LoginCredentials, remember: boolean) {
      const response = await authService.login(credentials)
      const nextSession = authStorage.write(response, remember)
      setSession(nextSession)
      return nextSession
    },
    async logout() {
      try {
        if (session) await authService.logout(session.accessToken)
      } finally {
        authStorage.clear()
        setSession(null)
      }
    },
    async changePassword(input: ChangePasswordInput) {
      if (!session) throw new Error('No active session')
      await authService.changePassword(session.accessToken, input)
      const nextSession = {
        ...session,
        user: { ...session.user, isPasswordChangeRequired: false },
      }
      authStorage.update(nextSession)
      setSession(nextSession)
    },
  }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
