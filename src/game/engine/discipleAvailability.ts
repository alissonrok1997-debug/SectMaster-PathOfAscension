import type { DiscipleInstance, GameState, LocationId } from '../types'
import { isDiscipleBoosted } from './cultivationBoost'
import { getDiscipleCombatPower } from './combatPower'
import { getInjurySeverity } from './injury'
import { isDowned } from './downed'
import { getBuildingDef } from '../data/buildingDefs'
import { getLocationDefFromState } from './world/worldQueries'

/**
 * Unified disciple-availability check (WORLD_MAP_DESIGN §8.5). Disciples are
 * claimable by buildings, missions, and — from the World Map wave on —
 * expeditions. Routing every "is this disciple free?" question through one
 * function is what stops those three claimants from drifting and double-booking
 * the same disciple.
 *
 * Garrison duty (FIRST_REALM_PLAN §4.1/§9) is a FOURTH claimant added in Wave B,
 * sharing this same gate rather than forking it. Unlike missions/expeditions it
 * has no `awayUntil` timer (garrison duty is open-ended, until recalled), so it
 * is checked independently of the `awayUntil` branch below, not folded into it.
 */

export type DiscipleHeldBy = 'building' | 'mission' | 'expedition' | 'garrison' | 'downed' | 'injured' | 'boosting'

/** The location a disciple is currently garrisoned at, if any (§4.1) — the source of truth is `LocationRuntime.garrison.discipleIds`, never a field on the disciple itself. */
export function getGarrisonLocationId(state: GameState, discipleId: string): LocationId | undefined {
  if (!state.world) return undefined
  for (const [locationId, runtime] of Object.entries(state.world.locations)) {
    if (runtime.garrison?.discipleIds?.includes(discipleId)) return locationId
  }
  return undefined
}

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

/**
 * One-line "what is this disciple doing right now", for disciple-selection lists.
 * Names the specific building/outpost (not just the category) so the player can
 * tell at a glance who is free and who is committed where. Occupation-focused:
 * injury/boost are performance modifiers shown elsewhere, not an occupation.
 */
export function describeDiscipleActivity(state: GameState, discipleId: string): string {
  const heldBy = getDiscipleAvailability(state, discipleId).heldBy
  if (heldBy === 'garrison') {
    const locationId = getGarrisonLocationId(state, discipleId)
    const name = locationId ? getLocationDefFromState(state, locationId)?.name : undefined
    return name ? `Garrisoned at ${name}` : 'Garrisoned'
  }
  if (heldBy === 'mission') return 'Away on a mission'
  if (heldBy === 'expedition') return 'Away on an expedition'
  if (heldBy === 'downed') return 'Downed — recovering'
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (disciple?.assignedBuildingId) return `Working at ${getBuildingDef(disciple.assignedBuildingId).name}`
  return 'Idle'
}

/**
 * The shared ordering for every disciple-selection list, in three tiers so the most
 * useful pick sits at the top: idle disciples first, then those working at a building,
 * then the busy/unavailable ones (away or garrisoned, shown disabled). Within each
 * tier, highest `score` first, then higher talent as the final tiebreaker. `score`
 * defaults to combat power; a surface that cares about a different fitness metric (e.g.
 * a mission's non-combat power rating) passes its own so the best pick surfaces on the
 * first page. Returns a comparator — sort a COPY of the roster with it, never the roster.
 */
export function compareDisciplesForSelection(
  state: GameState,
  combatPowerMult: number = 1,
  score?: (d: DiscipleInstance) => number,
): (a: DiscipleInstance, b: DiscipleInstance) => number {
  // 0 = idle (free, no building job), 1 = assigned to a building, 2 = away/garrisoned.
  const rank = (d: DiscipleInstance): number => {
    if (!getDiscipleAvailability(state, d.id).available) return 2
    return d.assignedBuildingId !== undefined ? 1 : 0
  }
  const scoreOf = score ?? ((d: DiscipleInstance) => getDiscipleCombatPower(d, combatPowerMult))
  return (a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff
    const scoreDiff = scoreOf(b) - scoreOf(a)
    if (scoreDiff !== 0) return scoreDiff
    return b.talent - a.talent
  }
}

export function getDiscipleAvailability(
  state: GameState,
  discipleId: string,
  now: number = Date.now(),
): DiscipleAvailability {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { available: false, label: 'Not found.' }

  // Garrison duty is its own hard lock, checked before (not folded into) the
  // awayUntil gate below — a garrisoned disciple never has awayUntil set.
  if (getGarrisonLocationId(state, discipleId) !== undefined) {
    return { available: false, heldBy: 'garrison', label: 'Stationed as a garrison.' }
  }

  // The one hard anti-double-book gate: an away disciple is exclusively claimed
  // and cannot take another away-assignment. The claimant is a mission or — from
  // the World Map wave — an expedition; branch the label on state.world.expeditions.
  if (disciple.awayUntil !== undefined) {
    if (state.world?.expeditions.some((e) => e.discipleIds.includes(discipleId))) {
      return { available: false, heldBy: 'expedition', label: 'Away on an expedition.' }
    }
    return { available: false, heldBy: 'mission', label: 'Away on a mission.' }
  }

  // Downed (Phase 5): a hard block like away/garrison — an incapacitated disciple can't be dispatched or garrisoned until they recover.
  if (isDowned(disciple, now)) {
    return { available: false, heldBy: 'downed', label: 'Downed — recovering.' }
  }

  // Descriptive-only statuses below: they colour UI labels but never block a new
  // away-assignment, preserving the pre-refactor dispatch/assignment behaviour.
  if (getInjurySeverity(disciple) !== 'none') {
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
