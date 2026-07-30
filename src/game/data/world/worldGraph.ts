import type { LocationId, ProvinceId, SectSiteId } from '../../types'
import { PROVINCE_DEFS, getProvinceDef } from './provinceDefs'
import { SECT_SITE_DEFS } from './sectSiteDefs'
import { LANDMARK_DEFS } from './landmarkDefs'

/**
 * Derived world topology (WORLD_MAP_DESIGN §3.1). Everything here is computed
 * once at module init from the static defs — pure, no state, no save footprint.
 * Engine code does O(1) lookups against these indexes instead of scanning the
 * location arrays inside a 250ms tick (§3.1): any per-tick linear scan over
 * locations is a design regression (§9.3).
 *
 * Data-integrity checks run at import and THROW: an asymmetric adjacency or a
 * dangling id is a data bug, and failing fast at load in this prototype is the
 * intended "validated symmetric ... should throw in dev" behaviour (§3.1).
 */

const provinceIds = PROVINCE_DEFS.map((p) => p.id)
const provinceIdSet = new Set<ProvinceId>(provinceIds)

const adjacency: Record<ProvinceId, ProvinceId[]> = {}
for (const province of PROVINCE_DEFS) {
  adjacency[province.id] = [...province.neighbours]
}

function validateGraph(): void {
  for (const province of PROVINCE_DEFS) {
    for (const neighbour of province.neighbours) {
      if (!provinceIdSet.has(neighbour)) {
        throw new Error(`worldGraph: province "${province.id}" lists unknown neighbour "${neighbour}".`)
      }
      if (!adjacency[neighbour].includes(province.id)) {
        throw new Error(
          `worldGraph: asymmetric adjacency — "${province.id}" → "${neighbour}" but not back. Adjacency must be undirected.`,
        )
      }
    }
    for (const siteId of province.sectSiteIds) {
      if (!SECT_SITE_DEFS.some((s) => s.id === siteId)) {
        throw new Error(`worldGraph: province "${province.id}" references unknown sect site "${siteId}".`)
      }
    }
    for (const landmarkId of province.landmarkIds) {
      if (!LANDMARK_DEFS.some((l) => l.id === landmarkId)) {
        throw new Error(`worldGraph: province "${province.id}" references unknown landmark "${landmarkId}".`)
      }
    }
  }
}

validateGraph()

// All-pairs hop distance via BFS from each province. ~a dozen nodes, computed
// once and frozen; distances are symmetric and cached in a nested map.
const hopTable: Record<ProvinceId, Record<ProvinceId, number>> = {}
for (const start of provinceIds) {
  const dist: Record<ProvinceId, number> = { [start]: 0 }
  const queue: ProvinceId[] = [start]
  while (queue.length > 0) {
    const current = queue.shift() as ProvinceId
    for (const neighbour of adjacency[current]) {
      if (dist[neighbour] === undefined) {
        dist[neighbour] = dist[current] + 1
        queue.push(neighbour)
      }
    }
  }
  hopTable[start] = dist
}

// Reverse indexes: id → owning province, so engine code never scans arrays.
const locationToProvince: Record<LocationId, ProvinceId> = {}
for (const landmark of LANDMARK_DEFS) {
  locationToProvince[landmark.id] = landmark.provinceId
}
const sectSiteToProvince: Record<SectSiteId, ProvinceId> = {}
for (const site of SECT_SITE_DEFS) {
  sectSiteToProvince[site.id] = site.provinceId
}

export function getNeighbours(provinceId: ProvinceId): ProvinceId[] {
  return adjacency[provinceId] ?? []
}

/**
 * Hop distance between two provinces (0 = same province). Returns Infinity if the
 * target is unreachable from the source — callers treat that as "no route".
 */
export function hopDistance(from: ProvinceId, to: ProvinceId): number {
  return hopTable[from]?.[to] ?? Infinity
}

export function getProvinceIdForLocation(locationId: LocationId): ProvinceId | undefined {
  return locationToProvince[locationId]
}

export function getProvinceIdForSectSite(sectSiteId: SectSiteId): ProvinceId | undefined {
  return sectSiteToProvince[sectSiteId]
}

/** Re-exported so callers have a single import point for province lookups. */
export { getProvinceDef }
