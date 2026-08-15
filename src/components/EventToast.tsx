import { useEffect, useRef, useState } from 'react'
import type { ScreenTabId } from '../game/data/screenTabs'
import { dismissToast, subscribeToToasts, type ToastEvent } from './toastChannel'

/**
 * The §13 event toast: a 44px chrome strip that slides down from behind the resource
 * strip, holds, and leaves. One at a time, the rest queued in `toastChannel`.
 *
 * **It is chrome, not a second overlay.** §12's one-overlay rule governs surfaces that
 * install a scrim and trap interaction; the test is whether the player can carry on
 * without acknowledging it. A sheet: no. This: yes — no scrim, blocks nothing, dismisses
 * itself, and the durable record survives in the log either way. It sits at `z-index: 19`,
 * one *below* `.app-hud`, so it is genuinely occluded mid-slide rather than pretending to
 * be, and `.resource-detail` (z 22) always wins the space when expanded.
 */

/** Death holds longest and never shortens. Everything else yields to a waiting queue. */
const HOLD_MS = { normal: 4000, pressured: 2600, loss: 6000 }

export function EventToast({
  activeTab,
  onNavigate,
}: {
  activeTab: ScreenTabId
  onNavigate: (tab: ScreenTabId) => void
}) {
  const [queue, setQueue] = useState<ToastEvent[]>([])
  const [leaving, setLeaving] = useState(false)
  /** Bumped to re-run the effect after a pause, since nothing else changes while blocked. */
  const [retry, setRetry] = useState(0)
  const pressureRef = useRef(0)

  useEffect(() => subscribeToToasts(setQueue), [])

  const current = queue[0]
  pressureRef.current = queue.length

  /*
   * Suppress a toast for the screen the player is already looking at — the list re-renders
   * under their eyes and a notice about it is the game not paying attention. A death is the
   * exception and always shows: a row silently vanishing is exactly what gets missed.
   */
  const redundant = current !== undefined && current.target === activeTab && current.severity !== 'loss'

  const currentId = current?.id

  useEffect(() => {
    if (!current) return
    if (redundant) {
      dismissToast(current.id)
      return
    }
    /*
     * Pause while a sheet or the breakthrough moment is up: the queue waits and resumes on
     * close rather than rendering above a scrim, which is the line that would actually make
     * this a second overlay. Queried rather than counted so `BottomSheet` — which §19 puts
     * on the preserve list — is not touched at all.
     */
    if (document.querySelector('.sheet-overlay, .breakthrough-moment')) {
      const poll = setTimeout(() => setRetry((n) => n + 1), 400)
      return () => clearTimeout(poll)
    }

    setLeaving(false)
    // Read through a ref so a *new* event arriving can't restart the visible toast's clock.
    const hold =
      current.severity === 'loss' ? HOLD_MS.loss : pressureRef.current > 1 ? HOLD_MS.pressured : HOLD_MS.normal
    const out = setTimeout(() => setLeaving(true), hold)
    const drop = setTimeout(() => dismissToast(current.id), hold + 120)
    return () => {
      clearTimeout(out)
      clearTimeout(drop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, redundant, retry])

  if (!current || redundant) return null

  const tap = () => {
    if (current.target) onNavigate(current.target)
    dismissToast(current.id)
  }

  return (
    <div
      className={`event-toast sev-${current.severity} ${leaving ? 'leaving' : ''}`}
      role="status"
      aria-live="polite"
      onClick={tap}
    >
      <p className="event-toast-title">{current.title}</p>
      <p className="event-toast-line">{current.line}</p>
    </div>
  )
}
