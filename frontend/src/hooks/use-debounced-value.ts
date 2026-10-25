import { useEffect, useState } from 'react'

export const DEFAULT_DEBOUNCE_MS = 400

export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DEBOUNCE_MS) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, value])

  return debouncedValue
}
