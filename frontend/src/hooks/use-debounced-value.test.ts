import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './use-debounced-value'

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers())

  it('keeps the previous value until the debounce interval finishes', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: '' } })

    rerender({ value: 's' })
    rerender({ value: 'so' })
    rerender({ value: 'soc' })

    expect(result.current).toBe('')
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('soc')
  })
})
