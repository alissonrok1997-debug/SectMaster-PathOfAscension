import type { Resources, ResourceArchetypeId } from '../../types'
import type { NumberRange } from '../../engine/rng'

/**
 * Generator templates for resource nodes (WORLD_MAP_DESIGN §5.4 / §10, filled in WORLD_PROCGEN_PLAN
 * Wave 3). One template per archetype: an archetype plus the *ranges* the seeded generator rolls
 * within, and a name-fragment table (combined with the territory name). Templates carry volume;
 * `dangerTier` is not rolled here — the generator sets it from region temperament + distance from
 * the territory seat. Biome→archetype weighting lives in `worldGenConfig.biomeNodeWeights`.
 */
export interface ResourceNodeTemplate {
  id: string
  archetypeId: ResourceArchetypeId
  /** Name fragments combined with the territory name to name a generated node. */
  nameFragments: string[]
  /** Which resource(s) a rolled node yields; amounts come from yieldPerVisitRange. */
  yieldKeys: (keyof Resources)[]
  yieldPerVisitRange: NumberRange
  capacityRange: NumberRange
  regenPerDayRange?: NumberRange
  /** Baseline only; the per-territory generator computes the actual dangerTier from region + distance. */
  dangerTierRange: NumberRange
  travelUnitsRange: NumberRange
  maxPartyRange: NumberRange
  onSiteDurationMsRange: NumberRange
}

export const RESOURCE_NODE_TEMPLATES: ResourceNodeTemplate[] = [
  {
    id: 'spiritCrystalCave',
    archetypeId: 'spiritCrystalCave',
    nameFragments: ['Crystal Cave', 'Grotto', 'Cavern', 'Hollow'],
    yieldKeys: ['qiStone'],
    yieldPerVisitRange: { min: 8, max: 14 },
    capacityRange: { min: 26, max: 44 },
    regenPerDayRange: { min: 2, max: 3 },
    dangerTierRange: { min: 2, max: 4 },
    travelUnitsRange: { min: 3, max: 7 },
    maxPartyRange: { min: 2, max: 3 },
    onSiteDurationMsRange: { min: 16_000, max: 24_000 },
  },
  {
    id: 'spiritSpring',
    archetypeId: 'spiritSpring',
    nameFragments: ['Spring', 'Basin', 'Wellspring'],
    yieldKeys: ['qiStone'],
    yieldPerVisitRange: { min: 6, max: 9 },
    capacityRange: { min: 36, max: 46 },
    regenPerDayRange: { min: 3, max: 6 },
    dangerTierRange: { min: 1, max: 2 },
    travelUnitsRange: { min: 2, max: 5 },
    maxPartyRange: { min: 2, max: 2 },
    onSiteDurationMsRange: { min: 13_000, max: 17_000 },
  },
  {
    id: 'spiritIronMine',
    archetypeId: 'spiritIronMine',
    nameFragments: ['Iron Mine', 'Vein', 'Lode', 'Shaft'],
    yieldKeys: ['ironEssence'],
    yieldPerVisitRange: { min: 9, max: 14 },
    capacityRange: { min: 28, max: 44 },
    dangerTierRange: { min: 1, max: 4 },
    travelUnitsRange: { min: 3, max: 7 },
    maxPartyRange: { min: 3, max: 3 },
    onSiteDurationMsRange: { min: 15_000, max: 21_000 },
  },
  {
    id: 'jadeQuarry',
    archetypeId: 'jadeQuarry',
    nameFragments: ['Quarry', 'Jade Pit', 'Stonecut'],
    yieldKeys: ['spiritStones'],
    yieldPerVisitRange: { min: 13, max: 22 },
    capacityRange: { min: 28, max: 42 },
    dangerTierRange: { min: 2, max: 5 },
    travelUnitsRange: { min: 3, max: 8 },
    maxPartyRange: { min: 2, max: 3 },
    onSiteDurationMsRange: { min: 16_000, max: 25_000 },
  },
  {
    id: 'spiritHerbValley',
    archetypeId: 'spiritHerbValley',
    nameFragments: ['Herb Valley', 'Meadow', 'Glade', 'Vale'],
    yieldKeys: ['spiritHerb'],
    yieldPerVisitRange: { min: 11, max: 15 },
    capacityRange: { min: 40, max: 50 },
    regenPerDayRange: { min: 3, max: 5 },
    dangerTierRange: { min: 1, max: 2 },
    travelUnitsRange: { min: 2, max: 5 },
    maxPartyRange: { min: 2, max: 3 },
    onSiteDurationMsRange: { min: 13_000, max: 18_000 },
  },
  {
    id: 'ancientForest',
    archetypeId: 'ancientForest',
    nameFragments: ['Grove', 'Timberstand', 'Old Wood'],
    yieldKeys: ['spiritWood'],
    yieldPerVisitRange: { min: 13, max: 17 },
    capacityRange: { min: 38, max: 50 },
    dangerTierRange: { min: 1, max: 2 },
    travelUnitsRange: { min: 3, max: 6 },
    maxPartyRange: { min: 3, max: 3 },
    onSiteDurationMsRange: { min: 14_000, max: 19_000 },
  },
  {
    id: 'beastHuntingGrounds',
    archetypeId: 'beastHuntingGrounds',
    nameFragments: ['Hunting Grounds', 'Range', 'Wilds'],
    yieldKeys: ['ironEssence', 'spiritStones'],
    yieldPerVisitRange: { min: 7, max: 11 },
    capacityRange: { min: 28, max: 40 },
    regenPerDayRange: { min: 2, max: 4 },
    dangerTierRange: { min: 3, max: 5 },
    travelUnitsRange: { min: 4, max: 8 },
    maxPartyRange: { min: 3, max: 4 },
    onSiteDurationMsRange: { min: 17_000, max: 24_000 },
  },
]

export function getNodeTemplate(id: string): ResourceNodeTemplate | undefined {
  return RESOURCE_NODE_TEMPLATES.find((t) => t.id === id)
}
