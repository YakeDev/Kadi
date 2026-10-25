import { useEffect, useRef } from 'react'

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'

export const useModalFocus = (isOpen, onClose) => {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!isOpen || !panelRef.current) return
    const panel = panelRef.current
    const opener = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const getControls = () =>
      [...panel.querySelectorAll(focusableSelector)].filter(
        (el) => el.getClientRects().length > 0
      )
    const firstInput = panel.querySelector(
      'input:not([disabled]), textarea:not([disabled])'
    )
    ;((firstInput?.getClientRects().length ? firstInput : null) || getControls()[0] || panel).focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const controls = getControls()
      const first = controls[0] || panel
      const last = controls[controls.length - 1] || panel
      if (
        !panel.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus()
    }
  }, [isOpen])

  return panelRef
}
