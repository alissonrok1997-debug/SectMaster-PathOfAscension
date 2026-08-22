import type {
  ExplorationArchetypeId,
  LocationDiscoveryRule,
  LocationId,
  MapPosition,
  OutpostUpgradePath,
  ProvinceId,
  Resources,
  ResourceArchetypeId,
  SectSiteId,
} from '../../types'

/**
 * Location definition shapes (FIRST_REALM_PLAN §3 / §3b). Handcrafted landmarks are **retired**
 * as of WORLD_PROCGEN_PLAN Wave 3: the First Realm's resource nodes are now generated per territory
 * (`engine/world/worldGeneration.ts` → `world.generatedNodes`), so `LANDMARK_DEFS` is empty and the
 * `worldQueries` seam simply merges zero landmarks with the generated nodes. The types stay because
 * the generated records are resolved as `ResourceLocationDefinition`s through `generatedNodeToDef`.
 *
 * Exploration locations (ruins, secret sites) remain deferred (FIRST_REALM_PLAN §11) — no fog of war
 * exists yet — but the shape is kept so that later wave is pure data, no engine change.
 */
export interface ResourceLocationDefinition {
  id: LocationId
  kind: 'resource'
  provinceId: ProvinceId
  /** The territory whose cell this node sits in (Wave 3); absent on any legacy/handcrafted node. */
  territoryId?: SectSiteId
  name: string
  archetypeId: ResourceArchetypeId
  /** Base payload for one full on-site gather cycle. */
  yieldPerVisit: Partial<Resources>
  /** Total cycles before depletion; Infinity allowed. */
  capacity: number
  /** Cycles restored per world-clock day; omitted = no regeneration. */
  regenPerDay?: number
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
  isLandmark: boolean
  /** Present only on locations that can be turned into a passive-yield outpost (§5.3); absent = not claimable. */
  upgradePath?: OutpostUpgradePath
}

export interface ExplorationLocationDefinition {
  id: LocationId
  kind: 'exploration'
  provinceId: ProvinceId
  name: string
  archetypeId: ExplorationArchetypeId
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
  /** 0–1 knowledge added per completed visit (§6.3). */
  knowledgePerVisit: number
  discoveryRule: LocationDiscoveryRule
  /** Key into the exploration reward tables authored in a later phase (§6.2). */
  rewardTableId: string
  isLandmark: boolean
}

export type LocationDefinition = ResourceLocationDefinition | ExplorationLocationDefinition

/** Retired to empty (Wave 3) — every resource node is now generated per territory. */
export const LANDMARK_DEFS: LocationDefinition[] = []

export function getLandmarkDef(id: LocationId): LocationDefinition | undefined {
  return LANDMARK_DEFS.find((l) => l.id === id)
}

export function getLandmarksForProvince(provinceId: ProvinceId): LocationDefinition[] {
  return LANDMARK_DEFS.filter((l) => l.provinceId === provinceId)
}
