import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Refcounted so stacked sheets (a picker opened from a detail sheet) don't have the
 * inner one restore body scroll when it closes.
 */
let openCount = 0

const DISMISS_DISTANCE_PX = 80

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Rendered in the header bar; the grab handle and close button are always present. */
  title?: string
  /** 'auto' hugs its content up to --sheet-max-h, 'full' always fills it. */
  height?: 'auto' | 'full'
  /** Pinned below the scroll area — use for the screen's primary action. */
  footer?: ReactNode
  /**
   * False for sheets that must be answered rather than closed (decision events, the
   * relocation prune that gates the whole shell): no overlay tap, Escape, swipe or ✕.
   */
  dismissible?: boolean
  children: ReactNode
}

/**
 * Bottom-anchored overlay panel. The single modal primitive for the mobile layout —
 * replaces the old centered `.modal-panel` and the Buildings caret drawer.
 *
 * Portalled to <body> so an ancestor's stacking context can't trap it, and depth-aware
 * so sheets can stack.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  height = 'auto',
  footer,
  dismissible = true,
  children,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  // State, not a ref: a nested sheet has to re-render to paint above its parent.
  const [depth, setDepth] = useState(0)
  const dragStartY = useRef<number | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // Body lock + stacking depth, held for as long as this sheet is open.
  useEffect(() => {
    if (!open) return
    setDepth(openCount++)
    document.body.style.overflow = 'hidden'
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    return () => {
      openCount = Math.max(0, openCount - 1)
      if (openCount === 0) document.body.style.overflow = ''
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Escape closes; Tab is trapped within the panel.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (dismissible) onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    },
    [onClose, dismissible],
  )

  // Swipe-down to dismiss, driven straight off the DOM node so dragging doesn't re-render.
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dismissible) return
    dragStartY.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !panelRef.current) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    panelRef.current.style.transform = `translateY(${dy}px)`
  }

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !panelRef.current) return
    const dy = e.clientY - dragStartY.current
    dragStartY.current = null
    panelRef.current.style.transform = ''
    if (dy > DISMISS_DISTANCE_PX) onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      className="sheet-overlay"
      style={{ zIndex: 100 + depth * 2 }}
      onClick={dismissible ? onClose : undefined}
      onKeyDown={onKeyDown}
    >
      <div
        className={`sheet-panel sheet-panel-${height}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-header"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          {dismissible && <span className="sheet-grip" aria-hidden="true" />}
          {title && <span className="sheet-title">{title}</span>}
          {dismissible && (
            <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>

        <div className="sheet-body">{children}</div>

        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
