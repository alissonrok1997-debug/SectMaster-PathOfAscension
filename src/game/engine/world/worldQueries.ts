import type { ExpeditionPurpose, GameState, GeneratedNodeRecord, LocationId, LocationRuntime, ProvinceId } from '../../types'
import { getProvinceDef, type ProvinceDefinition } from '../../data/world/provinceDefs'
import { SECT_SITE_DEFS, getSectSiteDef, getSectSitesForProvince, type SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { getSpiritVeinDef, type SpiritVeinDefinition } from '../../data/world/spiritVeinDefs'
import {
  getLandmarkDef,
  getLandmarksForProvince,
  type LocationDefinition,
  type ResourceLocationDefinition,
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

/**
 * Presents a stored generated node (§5.4) as a ResourceLocationDefinition so the
 * resolver can treat handcrafted landmarks and generated minor nodes uniformly
 * (§3.2). The record IS the definition — it was written authoritatively into the
 * save — so this only tags it as non-landmark.
 */
export function generatedNodeToDef(record: GeneratedNodeRecord): ResourceLocationDefinition {
  return { ...record, isLandmark: false }
}

/** Finds a stored generated node by id across every province's node list; undefined if none. */
function findGeneratedNode(state: GameState, locationId: LocationId): GeneratedNodeRecord | undefined {
  const byProvince = state.world?.generatedNodes
  if (!byProvince) return undefined
  for (const nodes of Object.values(byProvince)) {
    const match = nodes.find((n) => n.id === locationId)
    if (match) return match
  }
  return undefined
}

/**
 * The static definition for any location id — a handcrafted landmark or a stored
 * generated node — independent of runtime. The one place the two id namespaces
 * (§3.2) are unified into one LocationDefinition.
 */
export function getLocationDefFromState(state: GameState, locationId: LocationId): LocationDefinition | undefined {
  const landmark = getLandmarkDef(locationId)
  if (landmark) return landmark
  const generated = findGeneratedNode(state, locationId)
  return generated ? generatedNodeToDef(generated) : undefined
}

/**
 * The state-coupled resolver (§3.2): merges a location's static definition (or
 * stored generated record) with its sparse runtime into one read-only view.
 * Every engine function and component that needs live location state goes through
 * here rather than touching the two halves. Undefined for an unknown id.
 */
export function getLocation(state: GameState, locationId: LocationId): ResolvedLocation | undefined {
  const def = getLocationDefFromState(state, locationId)
  if (!def) return undefined
  return resolveLocation(def, state.world?.locations[locationId])
}

/**
 * Every location currently visible in a province — its handcrafted landmarks plus
 * any generated minor nodes — each merged with its sparse runtime. Phase 4 shows
 * all of them; discoveryRule/survey gating (§6.3) narrows exploration sites in a
 * later phase.
 */
export function getVisibleLocations(state: GameState, provinceId: ProvinceId): ResolvedLocation[] {
  const landmarks = getLandmarksForProvince(provinceId).map((def) =>
    resolveLocation(def, state.world?.locations[def.id]),
  )
  const generated = (state.world?.generatedNodes[provinceId] ?? []).map((rec) =>
    resolveLocation(generatedNodeToDef(rec), state.world?.locations[rec.id]),
  )
  return [...landmarks, ...generated]
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

/** Fixed party/timing constants for an assault on a sect seat (FIRST_REALM_PLAN §4.2) — sect sites carry no maxParty/onSiteDurationMs of their own (those are resource-node-specific fields). */
const SEAT_ASSAULT_MAX_PARTY = 6
const SEAT_ASSAULT_ON_SITE_MS = 30_000
const RAID_ON_SITE_MS = 15_000

export interface ExpeditionTargetMeta {
  name: string
  /** The target's own remoteness only — travel.ts adds the current seat's `travelUnitOffset` on top, same as it always has for resource nodes. */
  travelUnits: number
  maxParty: number
  onSiteDurationMs: number
}

/**
 * Unifies the two expedition-target shapes (a resource/exploration location,
 * or — new in Wave B — a sect site) behind one lookup, so travel.ts/
 * expeditions.ts don't need to special-case "is this a seat?" everywhere
 * (FIRST_REALM_PLAN §4.2's Claim/Raid can target either).
 */
export function getExpeditionTargetMeta(
  state: GameState,
  locationId: LocationId,
  purpose: ExpeditionPurpose,
): ExpeditionTargetMeta | undefined {
  const site = SECT_SITE_DEFS.find((s) => s.id === locationId)
  if (site) {
    return {
      name: site.name,
      travelUnits: site.travelUnitOffset,
      maxParty: SEAT_ASSAULT_MAX_PARTY,
      onSiteDurationMs: purpose === 'raid' ? RAID_ON_SITE_MS : SEAT_ASSAULT_ON_SITE_MS,
    }
  }
  const location = getLocation(state, locationId)
  if (!location) return undefined
  return {
    name: location.name,
    travelUnits: location.travelUnits,
    maxParty: location.maxParty,
    onSiteDurationMs: purpose === 'raid' ? RAID_ON_SITE_MS : location.onSiteDurationMs,
  }
}
