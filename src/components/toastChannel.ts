import type { ScreenTabId } from '../game/data/screenTabs'

/**
 * The event-toast channel (§13) — a queue-shaped sibling of `breakthroughChannel.ts`,
 * deliberately *outside* the game store for the same reason: a notice that lives for four
 * seconds should never become a save-format question.
 *
 * The channel is policy, the host component is pixels. Coalescing, the severity ladder,
 * the queue cap and eviction all live here, so the host only ever asks "what's next".
 *
 * §13's stated rule — "never a toast for anything the player caused directly" — doesn't
 * survive contact with a management game, where the player causes everything. The rule
 * this file implements instead is **latency**:
 *
 *     A toast fires when an outcome arrives at a moment the player did not choose.
 *
 * `useWorldWatcher` discriminates that with zero engine change, by checking whether
 * `simClock.totalElapsedMs` advanced — only `tick` advances it, so any other store update
 * is by definition a player action resolving synchronously into the screen they're on.
 */

/** Ordered low → high. Eviction drops the lowest, and ties break toward the older entry. */
export const TOAST_SEVERITY = ['gain', 'holding', 'doctrine', 'world', 'fail', 'injury', 'loss'] as const

export type ToastSeverity = (typeof TOAST_SEVERITY)[number]

export interface ToastEvent {
  /** Deduplication key within a batch; also React's key on the host. */
  id: string
  /** The proper noun, in the display face. A place, a building, a person. */
  title: string
  /** The verb and its outcome, in UI sans. */
  line: string
  severity: ToastSeverity
  /** Tab to open on tap. Omitted for a death — there is nowhere useful to go. */
  target?: ScreenTabId
}

/** Max simultaneous entries. A fourth is collapsed into a digest, never queued behind three. */
const QUEUE_CAP = 3

type Listener = (queue: ToastEvent[]) => void

let listener: Listener | undefined
let queue: ToastEvent[] = []

/** Only `EventToast` subscribes; a second subscriber would mean two strips. */
export function subscribeToToasts(fn: Listener): () => void {
  listener = fn
  fn(queue)
  return () => {
    if (listener === fn) listener = undefined
  }
}

function rank(severity: ToastSeverity): number {
  return TOAST_SEVERITY.indexOf(severity)
}

/**
 * Publish one tick's worth of events.
 *
 * Collapse before evict, never drain: twenty events at four seconds each is eighty
 * seconds of chrome. The caller has already coalesced same-kind events into one entry
 * ("Three parties return"); this adds the cross-kind cap on top.
 */
export function publishToasts(events: ToastEvent[]): void {
  if (events.length === 0) return

  const byRank = [...events].sort((a, b) => rank(b.severity) - rank(a.severity))
  const kept = byRank.slice(0, QUEUE_CAP)
  const overflow = byRank.length - kept.length
  if (overflow > 0) {
    kept[QUEUE_CAP - 1] = {
      id: `digest:${Date.now()}`,
      title: 'The sect stirs',
      line: `${overflow + 1} other matters resolved.`,
      severity: kept[QUEUE_CAP - 1].severity,
      target: 'sect',
    }
  }

  queue = [...queue, ...kept].sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, QUEUE_CAP)
  listener?.(queue)
}

/** One catch-up notice standing in for a whole batch — see `useWorldWatcher`'s guards. */
export function publishCatchUp(count: number): void {
  publishToasts([
    {
      id: `catchup:${Date.now()}`,
      title: 'While you were away',
      line: `${count} matter${count === 1 ? '' : 's'} resolved.`,
      severity: 'holding',
      target: 'sect',
    },
  ])
}

/** The host calls this when an entry's hold expires or the player taps it. */
export function dismissToast(id: string): void {
  queue = queue.filter((t) => t.id !== id)
  listener?.(queue)
}
