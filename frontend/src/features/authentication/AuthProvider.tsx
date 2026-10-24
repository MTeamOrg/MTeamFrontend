import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { AUTH_UNAUTHORIZED_EVENT } from '../../service/api-client'
import { authService } from './auth-service'
import { authStorage } from './auth-storage'
import { AuthContext } from './auth-context'
import type { ChangePasswordInput, LoginCredentials } from './auth-types'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(authStorage.read)
  const photoRevisionRef = useRef(0)
  const accessToken = session?.accessToken
  const isPasswordChangeRequired = session?.user.isPasswordChangeRequired

  const updateProfilePhoto = useCallback((photoUrl: string | null) => {
    const currentSession = authStorage.read()
    if (!currentSession || currentSession.accessToken !== accessToken) return
    photoRevisionRef.current += 1
    const nextSession = { ...currentSession, user: { ...currentSession.user, photoUrl } }
    const safeSession = authStorage.update(nextSession)
    if (safeSession) setSession(safeSession)
  }, [accessToken])

  useEffect(() => {
    const clearSession = () => setSession(null)
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearSession)
  }, [])

  useEffect(() => {
    const storedSession = authStorage.read()
    if (!storedSession || isPasswordChangeRequired) return
    let active = true
    const photoRevision = photoRevisionRef.current
    void authService.currentIdentity().then((identity) => {
      const currentSession = authStorage.read()
      if (!active || !currentSession || currentSession.accessToken !== accessToken) return
      const nextSession = {
        ...currentSession,
        user: {
          id: identity.id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email,
          role: identity.role,
          status: identity.status,
          isPasswordChangeRequired: identity.isPasswordChangeRequired,
          photoUrl: photoRevisionRef.current === photoRevision ? identity.photoUrl : currentSession.user.photoUrl,
        },
      }
      setSession(nextSession)
    }).catch(() => undefined)
    return () => { active = false }
  }, [accessToken, isPasswordChangeRequired])

  const value = useMemo(() => ({
    session,
    updateProfilePhoto,
    async login(credentials: LoginCredentials, remember: boolean) {
      const response = await authService.login(credentials)
      const nextSession = authStorage.write(response, remember)
      setSession(nextSession)
      return nextSession
    },
    async logout() {
      try {
        if (session) await authService.logout()
      } catch {
        // Local logout must finish even when the server cannot be reached.
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
      const safeSession = authStorage.update(nextSession)
      if (safeSession) setSession(safeSession)
    },
  }), [session, updateProfilePhoto])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
