import type { DiscipleInstance, GameState, LocationId, LocationRuntime, WorldState } from '../../types'
import { getSquadCombatPower, highestGradeLeaderId } from '../combatPower'
import { getDoctrineModifiers } from '../doctrine'
import { getGarrisonLocationId } from '../discipleAvailability'
import { getInjurySeverity } from '../injury'
import { isDowned } from '../downed'
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

/**
 * Who actually defends the seat (HEALTH_SYSTEM_PLAN Phase 5): healthy home disciples first — a wounded disciple
 * never fights while a fit one sits at home. The whole home roster is conscripted only when nobody is healthy
 * (someone must defend). Also excludes the downed, who are incapacitated. Drives both defence power and the
 * battle's real participants, so power and wound-exposure stay consistent.
 */
export function getSeatDefenders(state: GameState): DiscipleInstance[] {
  const now = Date.now()
  const home = getHomeDisciples(state).filter((d) => !isDowned(d, now))
  const healthy = home.filter((d) => getInjurySeverity(d) === 'none')
  return healthy.length > 0 ? healthy : home
}

export function getSeatDefensePower(state: GameState): number {
  const cp = getSquadCombatPower(getSeatDefenders(state), getDoctrineModifiers(state).combatPowerMult)
  return Math.round(cp * getWorldModifiers(state).defenceMult)
}

/** The disciple who commands seat defense (Phase 6): the player's saved choice if still among the defenders, else the highest-grade defender. Undefined only if nobody defends. */
export function getSeatDefenseLeaderId(state: GameState): string | undefined {
  const defenders = getSeatDefenders(state)
  if (state.defenseLeaderId && defenders.some((d) => d.id === state.defenseLeaderId)) return state.defenseLeaderId
  return highestGradeLeaderId(defenders)
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
  if (runtime.ownerId === state.sectId) {
    return locationId === state.sectLocation?.sectSiteId
      ? getSeatDefensePower(state)
      : getOutpostDefensePower(state, locationId)
  }
  return runtime.garrison?.strength ?? 0
}

/**
 * Syncs the player seat's cached `garrison.strength` (MULTIPLAYER_PLAN §2) — the same scalar NPC
 * seats have always carried, now maintained for the player's seat too.
 *
 * Why it exists: `getSeatDefensePower` answers a SHARED question ("how strong is this seat?") by
 * reading PRIVATE state (`state.disciples`). A rival can't do that — they can't see your roster. So
 * the number is denormalized onto the shared `LocationRuntime`, where anyone may read it, and the
 * private roster stays behind it as the detail only the owner sees.
 *
 * Written, never derived on read (§15.2): a value computed on demand can't be read for a sect that
 * isn't loaded, which is exactly the case that matters when someone attacks an offline defender.
 * Wave 4 moves this to per-intent recompute once writes become discrete server-side transactions;
 * until then the tick is the write boundary.
 */
export function recomputeSeatStrength(state: GameState): GameState {
  const seatId = state.sectLocation?.sectSiteId
  if (!state.world || !seatId) return state
  const runtime = state.world.locations[seatId]
  if (!runtime || runtime.ownerId !== state.sectId) return state

  const strength = getSeatDefensePower(state)
  if (runtime.garrison?.strength === strength) return state
  return {
    ...state,
    world: {
      ...state.world,
      locations: { ...state.world.locations, [seatId]: { ...runtime, garrison: { ...runtime.garrison, strength } } },
    },
  }
}

/**
 * The publicly-visible strength of any seat, owner-agnostic: the cached scalar, which is all a rival
 * ever gets to see. Prefer this over `getSeatDefensePower` anywhere the answer is about someone
 * else's seat — it reads only shared state.
 */
export function getPublicSeatStrength(world: WorldState | undefined, seatId: LocationId): number {
  return world?.locations[seatId]?.garrison?.strength ?? 0
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
  if (!runtime || runtime.ownerId !== state.sectId) {
    return { canGarrison: false, reason: 'You do not hold this location.' }
  }
  if (discipleIds.length === 0) return { canGarrison: false, reason: 'Assign at least one disciple.' }
  for (const id of discipleIds) {
    const disciple = state.disciples.find((d) => d.id === id)
    if (!disciple) return { canGarrison: false, reason: 'Disciple not found.' }
    if (disciple.awayUntil !== undefined) return { canGarrison: false, reason: `${disciple.name} is away.` }
    if (isDowned(disciple, Date.now())) return { canGarrison: false, reason: `${disciple.name} is downed and recovering.` }
    const existing = getGarrisonLocationId(state, id)
    if (existing !== undefined && existing !== locationId) {
      return { canGarrison: false, reason: `${disciple.name} is already garrisoned elsewhere.` }
    }
  }
  return { canGarrison: true }
}

/** Pure: stations `discipleIds` at `locationId`, replacing any prior garrison there (preserving its return-when-wounded setting). Caller re-validates via getGarrisonEligibility. */
export function garrisonSite(state: GameState, locationId: LocationId, discipleIds: string[]): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const existing = world.locations[locationId]!
  return { ...world.locations, [locationId]: { ...existing, garrison: { strength: 0, discipleIds, returnWhenWounded: existing.garrison?.returnWhenWounded } } }
}

/** Pure: toggles a player outpost's "return when wounded" auto-recall (HEALTH_SYSTEM_PLAN Phase 5). No-op if the site has no garrison entry. */
export function setGarrisonReturnWhenWounded(state: GameState, locationId: LocationId, value: boolean): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const existing = world.locations[locationId]
  if (!existing?.garrison) return world.locations
  return { ...world.locations, [locationId]: { ...existing, garrison: { ...existing.garrison, returnWhenWounded: value } } }
}

/**
 * If a player outpost's garrison has auto-recall enabled, pulls out every member who is now wounded (or already
 * gone) — freeing the slot and letting them regenerate at home, and shrinking their death window (Phase 5).
 * Called right after an outpost defense applies its wounds. Pure; returns updated locations.
 */
export function recallWoundedGarrison(state: GameState, locationId: LocationId): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const runtime = world.locations[locationId]
  const ids = runtime?.garrison?.discipleIds
  if (!runtime?.garrison?.returnWhenWounded || !ids?.length) return world.locations
  const remaining = ids.filter((id) => {
    const d = state.disciples.find((x) => x.id === id)
    return d !== undefined && getInjurySeverity(d) === 'none'
  })
  if (remaining.length === ids.length) return world.locations
  return { ...world.locations, [locationId]: { ...runtime, garrison: { ...runtime.garrison, discipleIds: remaining } } }
}

/** Pure: recalls every disciple stationed at `locationId`, leaving the outpost undefended. */
export function ungarrisonSite(state: GameState, locationId: LocationId): Record<LocationId, LocationRuntime> {
  const world = state.world!
  const existing = world.locations[locationId]
  if (!existing?.garrison) return world.locations
  return { ...world.locations, [locationId]: { ...existing, garrison: { ...existing.garrison, discipleIds: [] } } }
}
