import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEnterSearch } from './use-enter-search'

describe('useEnterSearch', () => {
  it('keeps typing local and submits only once until the request finishes', async () => {
    const { result } = renderHook(() => useEnterSearch())

    act(() => result.current.setInputValue('socio de prueba'))
    expect(result.current.submittedValue).toBe('')
    expect(result.current.submitSearch()).toBe(true)
    expect(result.current.submitSearch()).toBe(false)
    await waitFor(() => expect(result.current.submittedValue).toBe('socio de prueba'))

    act(() => result.current.syncLoading(true))
    act(() => result.current.syncLoading(false))
    expect(result.current.isSearchPending).toBe(false)
    expect(result.current.submitSearch()).toBe(true)
  })
})
