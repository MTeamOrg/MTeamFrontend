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

function isSafePersonName(value: unknown): value is string {
  if (!isSafeText(value, 100)) return false
  for (const character of value) {
    if (!/^[\p{L}\p{M} .'-]$/u.test(character)) return false
  }
  return true
}

function hasValidEmailShape(email: string): boolean {
  const atIndex = email.indexOf('@')
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@')) return false

  const localPart = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)
  const allowedLocalCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+-/=?^_`{|}~"
  if (localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false
  for (const character of localPart) {
    if (!allowedLocalCharacters.includes(character)) return false
  }

  if (domain.length > 253) return false
  const labels = domain.split('.')
  if (labels.length < 2) return false
  return labels.every(label => {
    if (label.length === 0 || label.length > 63 || label.startsWith('-') || label.endsWith('-')) return false
    for (const character of label) {
      const isAsciiLetterOrDigit = (character >= 'a' && character <= 'z')
        || (character >= 'A' && character <= 'Z')
        || (character >= '0' && character <= '9')
      if (!isAsciiLetterOrDigit && character !== '-') return false
    }
    return true
  })
}

function isSafePhotoUrl(value: unknown): value is string | null | undefined {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string' || value.length > 2048) return false

  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.hostname.length > 0
      && !url.username
      && !url.password
  } catch {
    return false
  }
}

export function parseAuthUser(value: unknown): AuthUser | null {
  if (!isRecord(value)) return null

  const { id, firstName, lastName, email, role, status, isPasswordChangeRequired, photoUrl } = value
  if (!isSafeText(id, 128)
    || !/^[a-zA-Z0-9_-]+$/.test(id)
    || !isSafePersonName(firstName)
    || !isSafePersonName(lastName)
    || !isSafeText(email, 254)
    || !hasValidEmailShape(email)
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
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TOKEN_LENGTH) return null
  for (const character of value) {
    if (!/^[a-zA-Z0-9._~-]$/.test(character)) return null
  }
  return value
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
