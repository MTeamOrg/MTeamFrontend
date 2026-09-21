import type { AuthSession, LoginResponse } from './auth-types'

const AUTH_STORAGE_KEY = 'mteam.auth'

function parseSession(value: string | null): AuthSession | null {
  if (!value) return null
  try {
    const session = JSON.parse(value) as AuthSession
    if (session.expiresAt <= Date.now()) return null
    return session
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
    const session = { ...response, expiresAt: Date.now() + response.expiresIn * 1000 }
    this.clear()
    const storage = remember ? localStorage : sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    return session
  },
  update(session: AuthSession) {
    const storage = localStorage.getItem(AUTH_STORAGE_KEY) ? localStorage : sessionStorage
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  },
  clear() {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  },
}
