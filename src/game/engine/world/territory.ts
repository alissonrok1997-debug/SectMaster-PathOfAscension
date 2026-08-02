import type { DiscipleInstance, GameState, LocationId, LocationRuntime } from '../../types'
import { getSquadCombatPower } from '../combatPower'
import { getDoctrineModifiers } from '../doctrine'
import { getGarrisonLocationId } from '../discipleAvailability'
import { getWorldModifiers } from './worldModifiers'

/**
 * Ownership & garrison model (FIRST_REALM_PLAN §4.1). Two distinct defense
 * sources, both funnelled through `combatPower.ts` + the aggregated
 * `defenceMult` (§4.5 — the first system to actually consume it):
 * - The player's SEAT is defended automatically by every disciple currently
 *   home (present at the sect — not away, not garrisoned elsewhere). No manual
 *   garrison step.
 * - A player-held OUTPOST is defended only by disciples explicitly assigned via
 *   `garrisonSite` — an unassigned outpost is undefended.
 * - An NPC-held seat/outpost uses its scalar `strength` (facade-expanded for
 *   player-facing fights in `engine/combat/battleSimulator.ts`).
 */

/** Disciples physically present at the sect: not away on a timed absence, not stationed as a garrison elsewhere. */
export function getHomeDisciples(state: GameState): DiscipleInstance[] {
  return state.disciples.filter((d) => d.awayUntil === undefined && getGarrisonLocationId(state, d.id) === undefined)
}

export function getSeatDefensePower(state: GameState): number {
  const home = getHomeDisciples(state)
  const cp = getSquadCombatPower(home, getDoctrineModifiers(state).combatPowerMult)
  return Math.round(cp * getWorldModifiers(state).defenceMult)
}

export function getOutpostGarrisonDisciples(state: GameState, locationId: LocationId): DiscipleInstance[] {
  const ids = state.world?.locations[locationId]?.garrison?.discipleIds ?? []
  return state.disciples.filter((d) => ids.includes(d.id))
}

export function getOutpostDefensePower(state: GameState, locationId: LocationId): number {
  const cp = getSquadCombatPower(getOutpostGarrisonDisciples(state, locationId), getDoctrineModifiers(state).combatPowerMult)
  return Math.round(cp * getWorldModifiers(state).defenceMult)
}

/**
 * The unified defender-power lookup expeditions.ts needs for Claim/Raid
 * resolution: player seat (home roster), player outpost (assigned garrison),
 * NPC-owned anything (its scalar `strength`), or 0 for a neutral/unowned site.
 */
export function getDefensePower(state: GameState, locationId: LocationId): number {
  const runtime = state.world?.locations[locationId]
  if (!runtime?.ownerId) return 0
  if (runtime.ownerId === 'player') {
    return locationId === state.sectLocation?.sectSiteId
      ? getSeatDefensePower(state)
      : getOutpostDefensePower(state, locationId)
  }
  return runtime.garrison?.strength ?? 0
}

export interface GarrisonEligibility {
  canGarrison: boolean
  reason?: string
}

/** Only a player-OWNED outpost can be garrisoned — the seat defends itself automatically (§4.1), never manually. */
export function getGarrisonEligibility(state: GameState, locationId: LocationId, discipleIds: string[]): GarrisonEligibility {
  if (!state.world) return { canGarrison: false, reason: 'Sect not founded.' }
  if (locationId === state.sectLocation?.sectSiteId) {
    return { canGarrison: false, reason: 'Your seat is defended automatically by every disciple at home.' }
  }
  const runtime = state.world.locations[locationId]
  if (!runtime || runtime.ownerId !== 'player') {
    return { canGarrison: false, reason: 'You do not hold this location.' }
  }
  if (discipleIds.length === 0) return { canGarrison: false, reason: 'Assign at least one disciple.' }
  for (const id of discipleIds) {
    const disciple = state.disciples.find((d) => d.id === id)
    if (!disciple) return { canGarrison: false, reason: 'Disciple not found.' }
    if (disciple.awayUntil !== undefined) return { canGarrison: false, reason: `${disciple.name} is away.` }
    const existing = getGarrisonLocationId(state, id)
    if (existing !== undefined && existing !== locationId) {
      return { canGarrison: false, reason: `${disciple.name} is already garrisoned elsewhere.` }
    }
  }
  return { canGarrison: true }
}

/** Pure: stations `discipleIds` at `locationId`, replacing any prior garrison there. Caller re-validates via getGarrisonEligibility. */
export function garrisonSite(state: GameState, locationId: LocationId, discipleIds: string[]): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const existing = world.locations[locationId]!
  return { ...world.locations, [locationId]: { ...existing, garrison: { strength: 0, discipleIds } } }
}

/** Pure: recalls every disciple stationed at `locationId`, leaving the outpost undefended. */
export function ungarrisonSite(state: GameState, locationId: LocationId): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const existing = world.locations[locationId]
  if (!existing?.garrison) return world.locations
  return { ...world.locations, [locationId]: { ...existing, garrison: { ...existing.garrison, discipleIds: [] } } }
}
