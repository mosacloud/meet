import { useEffect, useState } from 'react'

/**
 * Mosa-specific: tracks whether `query` currently matches, initialized
 * synchronously (no flash of the wrong layout on mount) and kept in sync via
 * a `matchMedia` change listener.
 *
 * Shared by MosaHomePage's ProfileDropdown and AppSwitcherButton, which
 * previously each declared this state and effect inline and identically.
 */
export const useMobileBreakpoint = (query: string) => {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}
