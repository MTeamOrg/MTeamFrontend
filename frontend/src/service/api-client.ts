import { environment } from '../config/environment'
import { authStorage } from '../features/authentication/auth-storage'

export const AUTH_UNAUTHORIZED_EVENT = 'mteam:auth-unauthorized'
export const AUTH_FORBIDDEN_EVENT = 'mteam:auth-forbidden'

export interface ApiErrorResponse {
  code: string
  message: string
  details: unknown
}

export class ApiError extends Error {
  readonly code: string
  readonly details: unknown
  readonly status: number

  constructor(status: number, error: ApiErrorResponse) {
    super(error.message)
    this.name = 'ApiError'
    this.status = status
    this.code = error.code
    this.details = error.details
  }
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  authenticated?: boolean
  body?: unknown
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { authenticated = true, body, headers, ...requestOptions } = options
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  const accessToken = authenticated ? authStorage.read()?.accessToken : undefined
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`${environment.apiUrl}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor. Verificá que el backend esté iniciado.',
      details: null,
    })
  }

  if (!response.ok) {
    const fallback: ApiErrorResponse = {
      code: 'UNEXPECTED_ERROR',
      message: 'No se pudo completar la solicitud.',
      details: null,
    }
    const error = (await response.json().catch(() => fallback)) as ApiErrorResponse
    if (response.status === 401) {
      authStorage.clear()
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
    }
    if (response.status === 403) window.dispatchEvent(new Event(AUTH_FORBIDDEN_EVENT))
    throw new ApiError(response.status, { ...fallback, ...error })
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  return (await response.json()) as T
}
