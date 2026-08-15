import type { CultivationRealm } from '../game/types'

/**
 * A one-slot event channel for the breakthrough moment (§16.3), deliberately *outside* the
 * game store.
 *
 * The moment is presentation only — it reports an outcome the engine has already resolved —
 * so putting it in `GameState` would mean a store field and a save-format question for
 * something that lives for 1.2 seconds. `attemptBreakthrough` is a synchronous zustand
 * action, so the caller can snapshot the disciple, run the action, read the new state and
 * publish the difference here, all in one handler.
 */
export type BreakthroughOutcome =
  | { kind: 'success'; name: string; realm: CultivationRealm }
  | { kind: 'failure'; name: string; consequence: 'wound' | 'downed' | 'death' }
  | { kind: 'tally'; results: { name: string; realm?: CultivationRealm; consequence?: 'wound' | 'downed' | 'death' }[] }

type Listener = (outcome: BreakthroughOutcome) => void

let listener: Listener | undefined

/** Only `BreakthroughMoment` subscribes; a second subscriber would mean two overlays. */
export function subscribeToBreakthroughMoment(fn: Listener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = undefined
  }
}

export function publishBreakthroughMoment(outcome: BreakthroughOutcome): void {
  listener?.(outcome)
}
