import type { AuthUser, LoginResponse } from './auth-types'

const MAX_TOKEN_LENGTH = 8192
const MAX_SESSION_SECONDS = 60 * 60 * 24 * 365

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some(character => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || codePoint === 0x7f
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value.trim() === value
    && !hasControlCharacters(value)
}

function isSafePhotoUrl(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string' || value.length > 2048) return false

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function parseAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null

  const { id, firstName, lastName, email, role, status, isPasswordChangeRequired, photoUrl } = value
  if (!isSafeText(id, 128)
    || !isSafeText(firstName, 100)
    || !isSafeText(lastName, 100)
    || !isSafeText(email, 254)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || (role !== 'MEMBER' && role !== 'TRAINER' && role !== 'ADMIN')
    || (status !== 'ACTIVE' && status !== 'INACTIVE')
    || typeof isPasswordChangeRequired !== 'boolean'
    || !isSafePhotoUrl(photoUrl)) {
    return null
  }

  return {
    id,
    firstName,
    lastName,
    email,
    role,
    status,
    isPasswordChangeRequired,
    ...(photoUrl === undefined ? {} : { photoUrl }),
  }
}

function parseToken(value: unknown): string | null {
  return typeof value === 'string'
    && value.length <= MAX_TOKEN_LENGTH
    && /^[\x21-\x7E]+$/.test(value)
    ? value
    : null
}

export function parseLoginResponse(value: unknown): LoginResponse | null {
  if (!isRecord(value)) return null

  const accessToken = parseToken(value.accessToken)
  const user = parseAuthUser(value.user)
  const { tokenType, expiresIn } = value
  if (!accessToken
    || tokenType !== 'Bearer'
    || typeof expiresIn !== 'number'
    || !Number.isSafeInteger(expiresIn)
    || expiresIn <= 0
    || expiresIn > MAX_SESSION_SECONDS
    || !user) {
    return null
  }

  return { accessToken, tokenType, expiresIn, user }
}

export function parseAuthSession(value: unknown): (LoginResponse & { expiresAt: number }) | null {
  if (!isRecord(value)) return null

  const login = parseLoginResponse(value)
  const { expiresAt } = value
  if (!login
    || typeof expiresAt !== 'number'
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= Date.now()
    || expiresAt > Date.now() + MAX_SESSION_SECONDS * 1000) {
    return null
  }

  return { ...login, expiresAt }
}
