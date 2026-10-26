import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useApiResource } from './use-api-resource'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('useApiResource', () => {
  it('loads on mount and reports loading, data and errors', async () => {
    const failing = vi.fn(async () => { throw new Error('No se pudo cargar') })
    const { result } = renderHook(() => useApiResource(failing))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.error).toBe('No se pudo cargar'))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('refresh updates the data without ever showing the loading state', async () => {
    let value = 'primera'
    const loader = vi.fn(async () => value)
    const loadingStates: boolean[] = []
    const { result } = renderHook(() => {
      const resource = useApiResource(loader)
      loadingStates.push(resource.loading)
      return resource
    })
    await waitFor(() => expect(result.current.data).toBe('primera'))
    loadingStates.length = 0

    value = 'segunda'
    await act(async () => { await result.current.refresh() })

    expect(result.current.data).toBe('segunda')
    expect(loadingStates.length).toBeGreaterThan(0)
    expect(loadingStates.every((isLoading) => !isLoading)).toBe(true)
  })

  it('refresh keeps what is on screen and stays quiet when the request fails', async () => {
    let failing = false
    const loader = vi.fn(async () => {
      if (failing) throw new Error('sin conexión')
      return 'datos'
    })
    const { result } = renderHook(() => useApiResource(loader))
    await waitFor(() => expect(result.current.data).toBe('datos'))

    failing = true
    await act(async () => { await result.current.refresh() })
    expect(result.current.data).toBe('datos')
    expect(result.current.error).toBe('')
  })

  it('refresh recovers a screen that was showing an error', async () => {
    let failing = true
    const loader = vi.fn(async () => {
      if (failing) throw new Error('sin conexión')
      return 'recuperado'
    })
    const { result } = renderHook(() => useApiResource(loader))
    await waitFor(() => expect(result.current.error).toBe('sin conexión'))

    failing = false
    await act(async () => { await result.current.refresh() })
    expect(result.current.data).toBe('recuperado')
    expect(result.current.error).toBe('')
  })

  it('an older answer never replaces a newer one', async () => {
    const answers = [deferred<string>(), deferred<string>(), deferred<string>()]
    let call = 0
    const loader = vi.fn(() => answers[call++]!.promise)
    const { result } = renderHook(() => useApiResource(loader))
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1))

    let older!: Promise<void>
    let newer!: Promise<void>
    act(() => { older = result.current.reload() })
    act(() => { newer = result.current.refresh() })
    await act(async () => { answers[2]!.resolve('reciente'); await newer })
    expect(result.current.data).toBe('reciente')

    await act(async () => { answers[1]!.resolve('vieja'); await older })
    answers[0]!.resolve('inicial')
    expect(result.current.data).toBe('reciente')
    expect(result.current.loading).toBe(false)
  })
})
