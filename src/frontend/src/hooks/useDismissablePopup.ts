import { RefObject, useEffect } from 'react'

/**
 * Mosa-specific: closes an open popup on an outside click or Escape,
 * returning focus to the trigger on Escape so keyboard users don't lose
 * their place. Shared by MosaHomePage's ProfileDropdown and
 * AppSwitcherButton, which previously each declared this effect inline and
 * identically.
 */
export const useDismissablePopup = (
  popupRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  setIsOpen: (isOpen: boolean) => void
) => {
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, popupRef, triggerRef, setIsOpen])
}
