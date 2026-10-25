import { useEffect, useState } from 'react'

const DEFAULT_LOADING_DELAY_MS = 150

export function useDelayedLoading(isLoading: boolean, delayMs = DEFAULT_LOADING_DELAY_MS) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      const timeout = window.setTimeout(() => setIsVisible(false), 0)
      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => setIsVisible(true), delayMs)
    return () => window.clearTimeout(timeout)
  }, [delayMs, isLoading])

  return isLoading && isVisible
}
