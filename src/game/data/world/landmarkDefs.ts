import type {
  ExplorationArchetypeId,
  LocationDiscoveryRule,
  LocationId,
  MapPosition,
  ProvinceId,
  Resources,
  ResourceArchetypeId,
} from '../../types'

/**
 * Handcrafted named locations (WORLD_MAP_DESIGN §5.1 / §6.1 / §10). A landmark
 * references an archetype for its mechanics and only states its own specifics
 * (name, distance, danger, yields). Generated minor nodes reuse
 * ResourceLocationDefinition in a later phase; landmarks are `isLandmark: true`.
 *
 * Future-facing optional fields from the design (upgradePath, storyBeats,
 * requirements, eventTableId) are deliberately omitted until the phase that
 * uses them — being optional, adding them later needs no save-version bump.
 */
export interface ResourceLocationDefinition {
  id: LocationId
  kind: 'resource'
  provinceId: ProvinceId
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

export const LANDMARK_DEFS: LocationDefinition[] = [
  // --- Azure Mountains ---
  {
    id: 'azureMountains.spiritIronMine',
    kind: 'resource',
    provinceId: 'azureMountains',
    name: 'Whitecrag Iron Mine',
    archetypeId: 'spiritIronMine',
    yieldPerVisit: { ironEssence: 12 },
    capacity: 40,
    dangerTier: 1,
    travelUnits: 3,
    mapPosition: { x: 0.32, y: 0.5 },
    maxParty: 3,
    onSiteDurationMs: 15_000,
    isLandmark: true,
  },
  {
    id: 'azureMountains.frostCrystalCave',
    kind: 'resource',
    provinceId: 'azureMountains',
    name: 'Frostglow Crystal Cave',
    archetypeId: 'spiritCrystalCave',
    yieldPerVisit: { qiStone: 10 },
    capacity: 30,
    regenPerDay: 3,
    dangerTier: 2,
    travelUnits: 5,
    mapPosition: { x: 0.18, y: 0.55 },
    maxParty: 2,
    onSiteDurationMs: 20_000,
    isLandmark: true,
  },
  {
    id: 'azureMountains.cloudpierceRuins',
    kind: 'exploration',
    provinceId: 'azureMountains',
    name: 'Cloudpierce Ruins',
    archetypeId: 'ancientRuins',
    dangerTier: 2,
    travelUnits: 6,
    mapPosition: { x: 0.4, y: 0.3 },
    maxParty: 3,
    onSiteDurationMs: 25_000,
    knowledgePerVisit: 0.2,
    discoveryRule: { kind: 'visible' },
    rewardTableId: 'ancientRuins.tier1',
    isLandmark: true,
  },
  // --- Verdant Basin ---
  {
    id: 'verdantBasin.herbValley',
    kind: 'resource',
    provinceId: 'verdantBasin',
    name: 'Nine-Petal Herb Valley',
    archetypeId: 'spiritHerbValley',
    yieldPerVisit: { spiritHerb: 14 },
    capacity: 50,
    regenPerDay: 5,
    dangerTier: 1,
    travelUnits: 3,
    mapPosition: { x: 0.48, y: 0.6 },
    maxParty: 3,
    onSiteDurationMs: 15_000,
    isLandmark: true,
  },
  {
    id: 'verdantBasin.elderwoodGrove',
    kind: 'resource',
    provinceId: 'verdantBasin',
    name: 'Elderwood Grove',
    archetypeId: 'ancientForest',
    yieldPerVisit: { spiritWood: 16 },
    capacity: 45,
    dangerTier: 1,
    travelUnits: 4,
    mapPosition: { x: 0.55, y: 0.62 },
    maxParty: 3,
    onSiteDurationMs: 16_000,
    isLandmark: true,
  },
  {
    id: 'verdantBasin.sunkenPavilion',
    kind: 'exploration',
    provinceId: 'verdantBasin',
    name: 'Sunken Immortal Pavilion',
    archetypeId: 'immortalPavilion',
    dangerTier: 3,
    travelUnits: 7,
    mapPosition: { x: 0.62, y: 0.5 },
    maxParty: 2,
    onSiteDurationMs: 30_000,
    knowledgePerVisit: 0.15,
    discoveryRule: { kind: 'surveyed', minSurveyProgress: 0.5 },
    rewardTableId: 'immortalPavilion.tier1',
    isLandmark: true,
  },
  // --- Ember Wastes ---
  {
    id: 'emberWastes.jadeQuarry',
    kind: 'resource',
    provinceId: 'emberWastes',
    name: 'Cinderjade Quarry',
    archetypeId: 'jadeQuarry',
    yieldPerVisit: { spiritStones: 18 },
    capacity: 35,
    dangerTier: 2,
    travelUnits: 5,
    mapPosition: { x: 0.72, y: 0.68 },
    maxParty: 3,
    onSiteDurationMs: 18_000,
    isLandmark: true,
  },
  {
    id: 'emberWastes.beastHuntingGrounds',
    kind: 'resource',
    provinceId: 'emberWastes',
    name: 'Ashmane Hunting Grounds',
    archetypeId: 'beastHuntingGrounds',
    yieldPerVisit: { ironEssence: 10, spiritStones: 8 },
    capacity: 40,
    regenPerDay: 4,
    dangerTier: 3,
    travelUnits: 6,
    mapPosition: { x: 0.8, y: 0.72 },
    maxParty: 4,
    onSiteDurationMs: 20_000,
    isLandmark: true,
  },
  {
    id: 'emberWastes.ashenBattlefield',
    kind: 'exploration',
    provinceId: 'emberWastes',
    name: 'Ashen Battlefield',
    archetypeId: 'ancientBattlefield',
    dangerTier: 4,
    travelUnits: 8,
    mapPosition: { x: 0.88, y: 0.6 },
    maxParty: 3,
    onSiteDurationMs: 32_000,
    knowledgePerVisit: 0.2,
    discoveryRule: { kind: 'visible' },
    rewardTableId: 'ancientBattlefield.tier1',
    isLandmark: true,
  },
]

export function getLandmarkDef(id: LocationId): LocationDefinition | undefined {
  return LANDMARK_DEFS.find((l) => l.id === id)
}

export function getLandmarksForProvince(provinceId: ProvinceId): LocationDefinition[] {
  return LANDMARK_DEFS.filter((l) => l.provinceId === provinceId)
}
