import type {
  ClimateId,
  NodeTemplateRoll,
  ProvinceId,
  ProvinceTheme,
  ProvinceUnlockRule,
  LocationId,
  MapPosition,
  SectSiteId,
} from '../../types'

/**
 * Provinces (WORLD_MAP_DESIGN §2) — the navigational unit and the carrier of the
 * shared properties (Spirit Vein tier, climate, difficulty, faction control) that
 * would otherwise repeat on every location. `neighbours` is the undirected travel
 * graph (validated symmetric in worldGraph.ts). Phase 1 authors the starter set
 * only; more provinces are pure data added later with no engine change (§13.2).
 *
 * `spiritVeinTier` / `difficultyTier` are raw numbers, not labels — the vein tier
 * resolves through spiritVeinDefs.ts. `nodeTemplateWeights` feeds minor-node
 * generation in a later phase and is empty here.
 */
export interface ProvinceDefinition {
  id: ProvinceId
  name: string
  theme: ProvinceTheme
  climate: ClimateId
  description: string
  spiritVeinTier: number
  difficultyTier: number
  neighbours: ProvinceId[]
  mapPosition: MapPosition
  mapShapeId: string
  hubTravelUnits: number
  sectSiteIds: SectSiteId[]
  landmarkIds: LocationId[]
  nodeTemplateWeights: NodeTemplateRoll[]
  controllingFactionId?: string
  unlockRule: ProvinceUnlockRule
}

export const PROVINCE_DEFS: ProvinceDefinition[] = [
  {
    id: 'azureMountains',
    name: 'Azure Mountains',
    theme: 'mountains',
    climate: 'temperate',
    description: 'Cloud-wrapped peaks with a steady spirit vein — a forgiving cradle for a young sect.',
    spiritVeinTier: 2,
    difficultyTier: 1,
    neighbours: ['verdantBasin'],
    mapPosition: { x: 0.25, y: 0.35 },
    mapShapeId: 'azureMountains',
    hubTravelUnits: 2,
    sectSiteIds: ['hiddenValley', 'cliffPlateau', 'sacredPeak'],
    landmarkIds: ['azureMountains.spiritIronMine', 'azureMountains.frostCrystalCave', 'azureMountains.cloudpierceRuins'],
    nodeTemplateWeights: [],
    unlockRule: { kind: 'starter' },
  },
  {
    id: 'verdantBasin',
    name: 'Verdant Basin',
    theme: 'wetlands',
    climate: 'humid',
    description: 'A green river basin thick with spirit herbs and old-growth timber; gentle, but its vein runs shallow.',
    spiritVeinTier: 1,
    difficultyTier: 1,
    neighbours: ['azureMountains', 'emberWastes'],
    mapPosition: { x: 0.5, y: 0.5 },
    mapShapeId: 'verdantBasin',
    hubTravelUnits: 3,
    sectSiteIds: ['riverBasin', 'mistfenHollow'],
    landmarkIds: ['verdantBasin.herbValley', 'verdantBasin.elderwoodGrove', 'verdantBasin.sunkenPavilion'],
    nodeTemplateWeights: [],
    unlockRule: { kind: 'starter' },
  },
  {
    id: 'emberWastes',
    name: 'Ember Wastes',
    theme: 'wastes',
    climate: 'volcanic',
    description: 'Scorched volcanic flats over a powerful vein — high reward, high danger, and contested by the Bloodmoon Cult.',
    spiritVeinTier: 3,
    difficultyTier: 3,
    neighbours: ['verdantBasin'],
    mapPosition: { x: 0.75, y: 0.6 },
    mapShapeId: 'emberWastes',
    hubTravelUnits: 4,
    sectSiteIds: ['cinderTerrace', 'obsidianSpire'],
    landmarkIds: ['emberWastes.jadeQuarry', 'emberWastes.beastHuntingGrounds', 'emberWastes.ashenBattlefield'],
    nodeTemplateWeights: [],
    controllingFactionId: 'bloodmoonCult',
    unlockRule: { kind: 'starter' },
  },
]

export function getProvinceDef(id: ProvinceId): ProvinceDefinition {
  const def = PROVINCE_DEFS.find((p) => p.id === id)
  if (!def) throw new Error(`Unknown province id: ${id}`)
  return def
}
