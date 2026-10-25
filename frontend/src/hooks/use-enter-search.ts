import { useCallback, useRef, useState } from 'react'

export function useEnterSearch(initialValue = '') {
  const [inputValue, setInputValue] = useState(initialValue)
  const [submittedValue, setSubmittedValue] = useState(initialValue)
  const [requestKey, setRequestKey] = useState(0)
  const [isSearchPending, setIsSearchPending] = useState(false)
  const isPendingRef = useRef(false)
  const hasStartedRef = useRef(false)

  const submitSearch = useCallback(() => {
    if (isPendingRef.current) return false
    isPendingRef.current = true
    hasStartedRef.current = false
    setIsSearchPending(true)
    setSubmittedValue(inputValue)
    setRequestKey((value) => value + 1)
    return true
  }, [inputValue])

  const syncLoading = useCallback((isLoading: boolean) => {
    if (!isPendingRef.current) return
    if (isLoading) {
      hasStartedRef.current = true
      return
    }
    if (!hasStartedRef.current) return
    isPendingRef.current = false
    hasStartedRef.current = false
    setIsSearchPending(false)
  }, [])

  return {
    inputValue,
    setInputValue,
    submittedValue,
    requestKey,
    isSearchPending,
    submitSearch,
    syncLoading,
  }
}
