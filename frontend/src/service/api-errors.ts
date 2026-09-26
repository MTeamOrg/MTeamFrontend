import { ApiError } from './api-client'

function fieldErrorKeys(details: unknown): string[] {
  if (!details || typeof details !== 'object') return []
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors
  if (!fieldErrors || typeof fieldErrors !== 'object') return []
  return Object.entries(fieldErrors as Record<string, unknown>)
    .filter(([, messages]) => Array.isArray(messages) && messages.length > 0)
    .map(([field]) => field)
}

// Adds the invalid field names from a backend VALIDATION_ERROR (zod flatten) to the message.
export function describeApiError(value: unknown, fallback: string, labels: Record<string, string> = {}) {
  if (!(value instanceof Error)) return fallback
  if (value instanceof ApiError && value.code === 'VALIDATION_ERROR') {
    const fields = fieldErrorKeys(value.details).map((field) => labels[field] ?? field)
    if (fields.length) return `${value.message}. Revisá: ${fields.join(', ')}.`
  }
  return value.message
}
