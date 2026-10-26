import { useSyncExternalStore } from 'react'

export const MOBILE_QUERY = '(max-width: 700px)'

function mediaQuery() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_QUERY)
    : null
}

function subscribe(onChange: () => void) {
  const query = mediaQuery()
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => mediaQuery()?.matches ?? false, () => false)
}
