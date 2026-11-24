import { RefObject, useEffect, useState } from 'react'

interface UsePopupPlacementOptions {
  /** Also recompute on `orientationchange` (AppSwitcherButton opts into this). */
  watchOrientation?: boolean
}

/**
 * Mosa-specific: tracks whether a popup anchored to `anchorRef` should open
 * upward instead of downward (to stay within the viewport), and the fixed
 * pixel offset it should open at. `threshold` is the distance from the
 * bottom of the viewport (in px) below which the popup flips upward.
 *
 * Shared by MosaHomePage's ProfileDropdown and AppSwitcherButton, which
 * previously each declared this measurement logic inline and near-
 * identically (differing only in `threshold` and whether they also listen
 * for `orientationchange`).
 *
 * Recomputes on open, window resize, and scroll (capture phase, so
 * scrollable ancestors are covered too). Returns a `measure` callback so
 * callers can force an immediate recomputation (e.g. right before toggling
 * `isOpen`, to avoid a one-frame-stale placement).
 */
export const usePopupPlacement = (
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  threshold: number,
  { watchOrientation = false }: UsePopupPlacementOptions = {}
) => {
  const [opensUpward, setOpensUpward] = useState(false)
  const [fixedOffset, setFixedOffset] = useState(0)

  const measure = () => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const upward = window.innerHeight - rect.bottom < threshold
    setOpensUpward(upward)
    setFixedOffset(upward ? window.innerHeight - rect.top + 8 : rect.bottom + 8)
  }

  useEffect(() => {
    if (!isOpen) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    if (watchOrientation) {
      window.addEventListener('orientationchange', measure)
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      if (watchOrientation) {
        window.removeEventListener('orientationchange', measure)
      }
    }
    // `measure` intentionally excluded: it closes over `anchorRef`/`threshold`,
    // which are stable for the lifetime of a given popup instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, threshold, watchOrientation])

  return { opensUpward, fixedOffset, measure }
}
