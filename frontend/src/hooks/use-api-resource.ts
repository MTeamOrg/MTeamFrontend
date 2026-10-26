import { useCallback, useEffect, useRef, useState } from 'react'

export function useApiResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const value = await loader()
      if (currentRequest === requestId.current) setData(value)
    } catch (value) {
      if (currentRequest === requestId.current) setError(value instanceof Error ? value.message : 'No se pudieron cargar los datos.')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [loader])
  // Background update: keeps what is on screen (no loading state, no error) and shares the request
  // counter with `load`, so an older answer can never replace a newer one.
  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    try {
      const value = await loader()
      if (currentRequest === requestId.current) {
        setData(value)
        setError('')
        setLoading(false)
      }
    } catch {
      // The next explicit load reports the problem; meanwhile the last known data stays visible.
    }
  }, [loader])
  useEffect(() => {
    const task = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(task)
  }, [load])
  return { data, loading, error, reload: load, refresh, setData }
}
