import { environment } from '../config/environment'

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
  accessToken?: string
  body?: unknown
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, body, headers, ...requestOptions } = options
  const requestHeaders = new Headers(headers)
  requestHeaders.set('Accept', 'application/json')
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set('Content-Type', 'application/json')

  const response = await fetch(`${environment.apiUrl}${path}`, {
    ...requestOptions,
    headers: requestHeaders,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    const fallback: ApiErrorResponse = {
      code: 'UNEXPECTED_ERROR',
      message: 'No se pudo completar la solicitud.',
      details: null,
    }
    const error = (await response.json().catch(() => fallback)) as ApiErrorResponse
    throw new ApiError(response.status, { ...fallback, ...error })
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
