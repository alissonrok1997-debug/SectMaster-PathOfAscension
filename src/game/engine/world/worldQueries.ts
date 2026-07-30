import type { GameState, LocationId, LocationRuntime, ProvinceId } from '../../types'
import { getProvinceDef, type ProvinceDefinition } from '../../data/world/provinceDefs'
import { getSectSiteDef, getSectSitesForProvince, type SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { getSpiritVeinDef, type SpiritVeinDefinition } from '../../data/world/spiritVeinDefs'
import {
  getLandmarkDef,
  getLandmarksForProvince,
  type LocationDefinition,
} from '../../data/world/landmarkDefs'

/**
 * The single static/runtime merge seam (WORLD_MAP_DESIGN §3.2 / §11). Every
 * engine function and component consumes ResolvedLocation and never touches the
 * definition and the sparse runtime halves directly — if that discipline slips,
 * the split leaks everywhere and save compatibility becomes unmaintainable.
 *
 * Phase 1 is state-agnostic: there is no GameState.world yet, so these operate on
 * definitions plus an optional sparse LocationRuntime, supplying pristine
 * defaults when none is stored. The state-coupled `getLocation(state, id)` and
 * survey-aware `getVisibleLocations` land with the runtime store in a later phase
 * as thin wrappers over `resolveLocation`.
 */

export type ResolvedLocation = LocationDefinition & { runtime: LocationRuntime }

/** Defaults for an untouched location (§5.2): pristine, undiscovered, full capacity. */
export function pristineLocationRuntime(def: LocationDefinition): LocationRuntime {
  return {
    discovered: false,
    remainingCapacity: def.kind === 'resource' ? def.capacity : Infinity,
    lastVisitedAt: 0,
    visitCount: 0,
    outpostLevel: 0,
    knowledge: 0,
    flags: [],
  }
}

export function resolveLocation(def: LocationDefinition, runtime?: LocationRuntime): ResolvedLocation {
  return { ...def, runtime: runtime ?? pristineLocationRuntime(def) }
}

export function getLocationDef(locationId: LocationId): LocationDefinition | undefined {
  return getLandmarkDef(locationId)
}

/** Resolves a location by id against an optional sparse runtime; undefined if the id is unknown. */
export function resolveLocationById(locationId: LocationId, runtime?: LocationRuntime): ResolvedLocation | undefined {
  const def = getLocationDef(locationId)
  return def ? resolveLocation(def, runtime) : undefined
}

export function getProvince(provinceId: ProvinceId): ProvinceDefinition {
  return getProvinceDef(provinceId)
}

export function getResolvedSite(sectSiteId: string): SectSiteDefinition {
  return getSectSiteDef(sectSiteId)
}

export function getProvinceSites(provinceId: ProvinceId): SectSiteDefinition[] {
  return getSectSitesForProvince(provinceId)
}

/** All handcrafted locations in a province, each resolved with pristine defaults (§3.3 Province layer). */
export function getProvinceLocations(provinceId: ProvinceId): ResolvedLocation[] {
  return getLandmarksForProvince(provinceId).map((def) => resolveLocation(def))
}

/** The Spirit Vein definition (name + multipliers) for a province's raw tier (§7). */
export function getProvinceSpiritVein(provinceId: ProvinceId): SpiritVeinDefinition {
  return getSpiritVeinDef(getProvinceDef(provinceId).spiritVeinTier)
}

/**
 * The founded sect's Spirit Vein tier (§7.3) — the single accessor the
 * construction / research eligibility gates read. Defaults to the baseline tier 1
 * pre-founding, where no vein gate should ever bind.
 */
export function getSpiritVeinTier(state: GameState): number {
  return state.sectLocation ? getProvinceDef(state.sectLocation.provinceId).spiritVeinTier : 1
}

/** The founded sect's Spirit Vein definition (name + multipliers). */
export function getSectSpiritVein(state: GameState): SpiritVeinDefinition {
  return getSpiritVeinDef(getSpiritVeinTier(state))
}
