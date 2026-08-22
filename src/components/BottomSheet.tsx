import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { UiIcon } from './UiIcon'
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
  /**
   * Rendered in the header bar; the grab handle and close button are always present.
   * Required even when `header` replaces its visual role — it is the panel's `aria-label`.
   */
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
  /**
   * Appended to `.sheet-panel`. The opt-in for a surface variant — a sheet passing
   * `"parchment"` gets the token ladder that the roster's wrapper cannot reach, because this
   * panel is portalled to <body> and no descendant selector of that wrapper applies to it.
   * Absent, the panel is exactly the dark sheet it has always been.
   */
  panelClassName?: string
  /**
   * Replaces the default `.sheet-title` render. The grip and the close button still render,
   * and `.sheet-close` is absolutely positioned at the right, so a custom header must leave
   * room for it. Use when a sheet's header has to carry more than a name — stepper arrows,
   * a count, a subtitle. Absent, the title renders exactly as before.
   */
  header?: ReactNode
  children: ReactNode
}

/**
 * Bottom-anchored overlay panel. The single modal primitive for the mobile layout —
 * replaces the old centered `.modal-panel` and the Buildings caret drawer.
 *
 * Portalled to <body> so an ancestor's stacking context can't trap it, and depth-aware
 * so sheets can stack.
 *
 * `panelClassName` and `header` are additive and default to nothing: with neither passed,
 * this renders the identical DOM it always did (§19 lists this component under "preserve —
 * working, don't touch", so the drag, focus trap, depth refcount, Escape handling and
 * `dismissible` behaviour are deliberately untouched).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  height = 'auto',
  footer,
  dismissible = true,
  panelClassName,
  header,
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
    /*
     * A press that STARTS on a control in the header must not take the pointer.
     * `setPointerCapture` retargets the whole gesture to the capturing element, and the
     * click that follows is dispatched against that element rather than the button — so the
     * button's handler never runs.
     *
     * This was live: measured in headless Chromium, the ✕ received 0 of 1 clicks with the
     * capture unguarded and 1 of 1 with this line, while drag-to-dismiss fired in both. It
     * went unnoticed because tapping the scrim, pressing Escape and dragging all close a
     * sheet too, so ✕ appeared to work. Worth a spot-check on iOS Safari, where pointer
     * capture and compatibility mouse events have their own history.
     */
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return
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
        /* `.filter(Boolean)` rather than a template literal: with panelClassName undefined
           the joined string is byte-identical to the old `sheet-panel sheet-panel-${height}`,
           with no trailing space for a caller to trip over. */
        className={['sheet-panel', `sheet-panel-${height}`, panelClassName].filter(Boolean).join(' ')}
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
          {/* `??`, not `||`: an explicitly empty header stays empty, while undefined (every
              existing call site) falls through to the title exactly as before. */}
          {header ?? (title && <span className="sheet-title">{title}</span>)}
          {dismissible && (
            <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
              <UiIcon name="close" size={20} />
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
