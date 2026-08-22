import type { GameState, LocationRuntime, NpcSect, PendingRelocationState, SectLocation, WorldState } from '../../types'
import { getSite, getSites } from './worldAccess'

/** Pristine defaults for a location that has never had a runtime entry (mirrors worldQueries.ts's pristineLocationRuntime for the sect-site case). */
const EMPTY_SITE_RUNTIME: LocationRuntime = {
  discovered: false,
  remainingCapacity: Infinity,
  lastVisitedAt: 0,
  visitCount: 0,
  outpostLevel: 0,
  knowledge: 0,
  flags: [],
}

/**
 * Every free Poor seat — never conquerable, so this is the founding pool AND
 * the fallback a defeated player retreats to (§4.2's player exception) AND
 * where the emergence mechanic spawns new minor sects (§4.3). All three
 * consumers share this one query so "what counts as free" can never drift.
 */
export function getFreePoorSeatIds(world: WorldState | undefined, locations: Record<string, LocationRuntime>): string[] {
  return getSites(world).filter((s) => s.tier === 'poor' && !locations[s.id]?.ownerId).map((s) => s.id)
}

export interface ConquestParams {
  now: number
  /** A sect id (the local player's `state.sectId`, or an NpcSect id) — whoever is relocating INTO `targetSeatId`. */
  attackerId: string
  attackerOldSeatId: string
  targetSeatId: string
  /** A sect id, or undefined for an already-neutral (vacated) seat — nothing to destroy/retreat in that case. */
  defenderId?: string
  /** Required when the defender is the player — the free Poor seat they retreat to. Picked by the caller (may need a seeded roll among `getFreePoorSeatIds`), since this function stays a pure, deterministic function of its explicit inputs. */
  playerRetreatSiteId?: string
}

export interface ConquestResult {
  sectLocation?: SectLocation
  locations: Record<string, LocationRuntime>
  npcSects: NpcSect[]
  pendingRelocation?: PendingRelocationState
  /** Set only when the defender was the player and got forced to retreat — callers use this to log/notify. */
  playerRetreatedToSiteId?: string
}

/**
 * The one seat-conquest primitive (FIRST_REALM_PLAN §4.2/§4.3), shared by every
 * attacker/defender combination: the player conquering an NPC seat (Wave B),
 * an NPC climbing onto a rival NPC's seat, an NPC climbing onto an *unowned*
 * (already-vacated) prestige seat (no defender to destroy), and — new in Wave
 * C — an NPC climbing onto the PLAYER's seat, where the player is the "sole
 * exception" that retreats to a free Poor seat instead of being destroyed
 * (§4.2). One function keeps all four cases from drifting into near-duplicate
 * copies of "free the old seat, abandon outposts, claim the new one."
 *
 * Buildings are never force-pruned here — an over-cap player relocation just
 * flags `pendingRelocation` (existing `noBuildingSlots` gates block further
 * construction until resolved via RelocationPruneModal); NPCs have no
 * buildings to prune.
 */
export function applyConquest(state: GameState, params: ConquestParams): ConquestResult {
  const world = state.world!
  const { now, attackerId, attackerOldSeatId, targetSeatId, defenderId, playerRetreatSiteId } = params
  const locations: Record<string, LocationRuntime> = { ...world.locations }
  let npcSects = world.npcSects
  let sectLocation = state.sectLocation
  let playerRetreatedToSiteId: string | undefined

  // Free the attacker's old seat.
  locations[attackerOldSeatId] = { ...(locations[attackerOldSeatId] ?? EMPTY_SITE_RUNTIME), ownerId: undefined, garrison: undefined }
  // Abandon every other location the attacker held — left outside the new influence bubble (§4.2/§4.6).
  for (const [locId, runtime] of Object.entries(locations)) {
    if (locId === attackerOldSeatId || locId === targetSeatId) continue
    if (runtime.ownerId === attackerId) {
      locations[locId] = { ...runtime, ownerId: undefined, outpostLevel: 0, garrison: undefined }
    }
  }

  if (defenderId === state.sectId && playerRetreatSiteId) {
    // The player is the sole exception: retreat to a free Poor seat instead of being destroyed (§4.2).
    for (const [locId, runtime] of Object.entries(locations)) {
      if (locId !== targetSeatId && runtime.ownerId === state.sectId) {
        locations[locId] = { ...runtime, ownerId: undefined, outpostLevel: 0, garrison: undefined }
      }
    }
    locations[playerRetreatSiteId] = {
      ...(locations[playerRetreatSiteId] ?? EMPTY_SITE_RUNTIME),
      ownerId: state.sectId,
      garrison: undefined,
      discovered: true,
    }
    sectLocation = state.sectLocation ? { ...state.sectLocation, sectSiteId: playerRetreatSiteId } : sectLocation
    playerRetreatedToSiteId = playerRetreatSiteId
  } else if (defenderId) {
    npcSects = npcSects.filter((n) => n.id !== defenderId)
  }
  // else: defenderId undefined — the seat was already neutral, nothing to destroy.

  locations[targetSeatId] = {
    ...(locations[targetSeatId] ?? EMPTY_SITE_RUNTIME),
    ownerId: attackerId,
    garrison: undefined,
    discovered: true,
  }

  let pendingRelocation: PendingRelocationState | undefined
  if (attackerId === state.sectId) {
    sectLocation = state.sectLocation ? { ...state.sectLocation, sectSiteId: targetSeatId } : sectLocation
    const newCap = getSite(state.world, targetSeatId).buildingSlots
    const buildingCount = Object.keys(state.buildings).length
    if (buildingCount > newCap) {
      pendingRelocation = {
        newSiteId: targetSeatId,
        oldSiteId: attackerOldSeatId,
        defeatedNpcSectId: defenderId ?? '',
        requiredRemovals: buildingCount - newCap,
      }
    }
  } else {
    npcSects = npcSects.map((n) => (n.id === attackerId ? { ...n, seatSiteId: targetSeatId, seatSince: now } : n))
  }

  return { sectLocation, locations, npcSects, pendingRelocation, playerRetreatedToSiteId }
}
