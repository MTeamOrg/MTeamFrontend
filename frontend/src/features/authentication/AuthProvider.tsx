import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { AUTH_UNAUTHORIZED_EVENT } from '../../service/api-client'
import { authService } from './auth-service'
import { authStorage } from './auth-storage'
import { AuthContext } from './auth-context'
import type { ChangePasswordInput, LoginCredentials } from './auth-types'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(authStorage.read)

  useEffect(() => {
    const clearSession = () => setSession(null)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)
  }, [])

  useEffect(() => {
    const storedSession = authStorage.read()
    if (!storedSession || storedSession.user.isPasswordChangeRequired) return
    let active = true
    void authService.currentIdentity().then((identity) => {
      if (!active) return
      const nextSession = {
        ...storedSession,
        user: {
          id: identity.id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          role: identity.role,
          status: identity.status,
          isPasswordChangeRequired: identity.isPasswordChangeRequired,
        },
      }
      authStorage.update(nextSession)
      setSession(nextSession)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

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
        if (session) await authService.logout()
      } finally {
        authStorage.clear()
        setSession(null)
      }
    },
    async changePassword(input: ChangePasswordInput) {
      if (!session) throw new Error('No active session')
      await authService.changePassword(input)
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
