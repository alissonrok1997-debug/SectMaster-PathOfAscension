import type { GameState } from '../types'
import { isDiscipleBoosted } from './cultivationBoost'

/**
 * Unified disciple-availability check (WORLD_MAP_DESIGN §8.5). Disciples are
 * claimable by buildings, missions, and — from the World Map wave on —
 * expeditions. Routing every "is this disciple free?" question through one
 * function is what stops those three claimants from drifting and double-booking
 * the same disciple.
 */

export type DiscipleHeldBy = 'building' | 'mission' | 'expedition' | 'injured' | 'boosting'

export interface DiscipleAvailability {
  /**
   * Free to be sent away on a new mission/expedition — the exclusive claimants.
   * A disciple assigned to a building, injured, or mid cultivation-boost is still
   * `available` (they simply leave the building when dispatched, and injury/boost
   * are performance modifiers, not locks), which matches pre-refactor behaviour.
   * Only the Presence Requirement away-lock (doc 03 §8) makes them unavailable.
   */
  available: boolean
  /** Primary current occupation, priority away > injured > boosting > building; undefined when idle. Only the away states set `available` to false. */
  heldBy?: DiscipleHeldBy
  /** Short human-readable status for UI labels. */
  label: string
}

export function getDiscipleAvailability(
  state: GameState,
  discipleId: string,
  now: number = Date.now(),
): DiscipleAvailability {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { available: false, label: 'Not found.' }

  // The one hard anti-double-book gate: an away disciple is exclusively claimed
  // and cannot take another away-assignment. Away means a mission at this scope;
  // the World Map wave branches heldBy on state.world.expeditions here.
  if (disciple.awayUntil !== undefined) {
    return { available: false, heldBy: 'mission', label: 'Away on a mission.' }
  }

  // Descriptive-only statuses below: they colour UI labels but never block a new
  // away-assignment, preserving the pre-refactor dispatch/assignment behaviour.
  if (disciple.injury !== 'none') {
    return { available: true, heldBy: 'injured', label: 'Injured.' }
  }
  if (isDiscipleBoosted(disciple, now)) {
    return { available: true, heldBy: 'boosting', label: 'Cultivation boost active.' }
  }
  if (disciple.assignedBuildingId !== undefined) {
    return { available: true, heldBy: 'building', label: 'Assigned to a building.' }
  }
  return { available: true, label: 'Available.' }
}
