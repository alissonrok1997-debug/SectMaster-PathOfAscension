import type { GameState, LocationId, MapPosition, NpcSect, SectSiteTier } from '../../types'
import { SECT_SITE_DEFS, getSectSiteDef } from '../../data/world/sectSiteDefs'
import { getLocationDefFromState } from './worldQueries'
import { getSeatDefensePower } from './territory'

/**
 * Influence range (FIRST_REALM_PLAN §4.6): you can only claim/hold a resource
 * outpost near what you already hold. Derived, not stored — a pure query over
 * already-persisted state (the seat + its home-roster strength), mirroring
 * `getWorldModifiers`. Seat conquest is deliberately NOT gated by this (the
 * climb must always be reachable, §1) — only resource-outpost claim/garrison
 * reads it (§4.2).
 *
 * Wave C's npcSimulation reuses the exact same radius formula for NPCs
 * (`getNpcInfluenceRadius`/`isWithinNpcInfluence`) — "symmetric and cheap" per
 * §4.6, no separate NPC-only distance math.
 */

const BASE_INFLUENCE_BY_TIER: Record<SectSiteTier, number> = { poor: 0.14, normal: 0.24, good: 0.36 }

/** Stronger defense widens the bubble a little; no "Sect Banner" beacon building exists yet, so that multiplier is left out rather than faked (same honesty convention as `defenceMult` in Wave A). */
function computeInfluenceRadius(tier: SectSiteTier, defensePower: number): number {
  const garrisonFactor = Math.min(1, defensePower / 400)
  return BASE_INFLUENCE_BY_TIER[tier] * (1 + garrisonFactor * 0.5)
}

export function getInfluenceRadius(state: GameState): number {
  if (!state.sectLocation) return 0
  const tier = getSectSiteDef(state.sectLocation.sectSiteId).tier
  return computeInfluenceRadius(tier, getSeatDefensePower(state))
}

/** An NPC's influence radiates from its one seat, scaled by its abstract `strength` in place of a live home-roster reading (§4.3's NPCs are a scalar, not a real roster). */
export function getNpcInfluenceRadius(npc: NpcSect): number {
  return computeInfluenceRadius(getSectSiteDef(npc.seatSiteId).tier, npc.strength)
}

export interface InfluenceField {
  center: MapPosition
  radius: number
}

/** Because the anchor is the single seat (§1), the whole bubble picks up and moves on relocation — climbing to a Normal/Good seat expands reach directly. */
export function getInfluenceField(state: GameState): InfluenceField {
  if (!state.sectLocation) return { center: { x: 0, y: 0 }, radius: 0 }
  return { center: getSectSiteDef(state.sectLocation.sectSiteId).mapPosition, radius: getInfluenceRadius(state) }
}

export function getLocationPosition(state: GameState, locationId: LocationId): MapPosition | undefined {
  const site = SECT_SITE_DEFS.find((s) => s.id === locationId)
  if (site) return site.mapPosition
  return getLocationDefFromState(state, locationId)?.mapPosition
}

/** Normalized map-distance metric, matching the rendered bubble 1:1 (§4.6). */
export function isWithinInfluence(state: GameState, locationId: LocationId): boolean {
  if (!state.sectLocation) return false
  const target = getLocationPosition(state, locationId)
  if (!target) return false
  const field = getInfluenceField(state)
  const dist = Math.hypot(target.x - field.center.x, target.y - field.center.y)
  return dist <= field.radius
}

/** Same metric, from an NPC's own seat — region-partitioned lookups already keep this O(1) per check, never O(N²) (§4.3). */
export function isWithinNpcInfluence(state: GameState, npc: NpcSect, locationId: LocationId): boolean {
  const target = getLocationPosition(state, locationId)
  if (!target) return false
  const anchor = getSectSiteDef(npc.seatSiteId).mapPosition
  const dist = Math.hypot(target.x - anchor.x, target.y - anchor.y)
  return dist <= getNpcInfluenceRadius(npc)
}
