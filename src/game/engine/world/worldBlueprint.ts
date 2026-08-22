import type {
  GeneratedTerritory,
  LocationId,
  SectSiteId,
  WorldBlueprint,
} from '../../types'
import { SECT_SITE_DEFS, type SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { NPC_SECT_DEFS } from '../../data/world/npcSectDefs'
import { LANDMARK_DEFS, type ResourceLocationDefinition } from '../../data/world/landmarkDefs'
import { getProvinceDef } from '../../data/world/provinceDefs'
import { WORLD_DEF } from '../../data/world/worldDef'
import { computeRealmArt, type MapArtSite } from './mapArt'

/**
 * The blueprint the legacy realm packages into (WORLD_PROCGEN_PLAN Wave 1). This is the
 * *identity* generator: it wraps today's authored `SECT_SITE_DEFS` / `NPC_SECT_DEFS` /
 * `LANDMARK_DEFS` / province into a `WorldBlueprint` with the exact same values, so
 * founding stores a blueprint and the `worldAccess` shim can read it with zero behavioural
 * change. Wave 2 swaps this out for `generateBlueprint(seed, config)`.
 *
 * Stamp this whenever the packaging changes so a save always records which generator built
 * it; a later generator never rewrites a live world (it keeps its stored blueprint).
 */
export const WORLD_GEN_VERSION = 1

const FIRST_REALM = 'firstRealm' as const

/** Delaunay-dual adjacency for the fixed authored seats, keyed by site id. */
function legacyTerritories(seed: number): GeneratedTerritory[] {
  const projection: MapArtSite[] = SECT_SITE_DEFS.map((s) => ({
    id: s.id,
    regionId: s.regionId,
    tier: s.tier,
    mapPosition: s.mapPosition,
  }))
  const art = computeRealmArt(projection, seed, {
    width: WORLD_DEF.map.viewBoxWidth,
    height: WORLD_DEF.map.viewBoxHeight,
  })
  const neighboursById = new Map<SectSiteId, SectSiteId[]>(art.cells.map((c) => [c.id, c.neighbours]))
  const veinTier = getProvinceDef(FIRST_REALM).spiritVeinTier
  return SECT_SITE_DEFS.map((s) => ({
    id: s.id,
    name: s.name,
    regionId: s.regionId,
    tier: s.tier,
    seat: s.mapPosition,
    neighbours: neighboursById.get(s.id) ?? [],
    spiritVeinTier: veinTier,
  }))
}

export function buildLegacyBlueprint(seed: number): WorldBlueprint {
  // Insertion order = SECT_SITE_DEFS order, so getSites() preserves the authored ordering.
  const sites: Record<SectSiteId, SectSiteDefinition> = {}
  for (const s of SECT_SITE_DEFS) sites[s.id] = s

  const nodes: Record<LocationId, ResourceLocationDefinition> = {}
  for (const l of LANDMARK_DEFS) if (l.kind === 'resource') nodes[l.id] = l

  return {
    seed,
    genVersion: WORLD_GEN_VERSION,
    territories: legacyTerritories(seed),
    sites,
    nodes,
    npcSeeds: NPC_SECT_DEFS.map((n) => ({ ...n, stockpile: { ...n.stockpile } })),
    province: getProvinceDef(FIRST_REALM),
  }
}
