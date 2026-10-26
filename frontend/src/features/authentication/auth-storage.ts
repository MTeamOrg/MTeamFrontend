import type { AuthSession, LoginResponse } from './auth-types'
import { parseAuthSession, parseLoginResponse } from './auth-validation'

const AUTH_STORAGE_KEY = 'mteam.auth'

function parseSession(value: string | null): AuthSession | null {
  if (!value) return null
  try {
    return parseAuthSession(JSON.parse(value))
  } catch {
    return null
  }
}

export const authStorage = {
  read(): AuthSession | null {
    const persistent = parseSession(localStorage.getItem(AUTH_STORAGE_KEY))
    const temporary = parseSession(sessionStorage.getItem(AUTH_STORAGE_KEY))
    if (!persistent) localStorage.removeItem(AUTH_STORAGE_KEY)
    if (!temporary) sessionStorage.removeItem(AUTH_STORAGE_KEY)
    return persistent ?? temporary
  },
  write(response: LoginResponse, remember: boolean): AuthSession {
    const safeResponse = parseLoginResponse(response)
    if (!safeResponse) throw new Error('El servidor devolvió una respuesta de autenticación inválida.')
    const session: AuthSession = { ...safeResponse, expiresAt: Date.now() + safeResponse.expiresIn * 1000 }
    this.clear()
    const storage = remember ? localStorage : sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    return session
  },
  update(session: AuthSession): AuthSession | null {
    const safeSession = parseAuthSession(session)
    if (!safeSession) return null
    const storage = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeSession))
    return safeSession
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  },
}
