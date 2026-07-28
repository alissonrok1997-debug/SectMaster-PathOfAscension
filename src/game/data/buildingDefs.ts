import type { BuildingCategory, Resources } from '../types'

export interface BuildingDefinition {
  id: string
  name: string
  category: BuildingCategory
  description: string
  /** Resource this building produces continuously. Absent for Sect Hall and non-production buildings. */
  produces?: keyof Resources
  /** Resource units generated per second, per building level. */
  baseRatePerLevel?: number
  /** Resource cost for the first upgrade (level 1 -> 2). Scales by costGrowth per level after that. */
  baseCost: Partial<Resources>
  costGrowth: number
  baseDurationMs: number
  durationGrowthMs: number
}

/** Cost to take `currentLevel` to `currentLevel + 1`. */
export function getUpgradeCost(def: BuildingDefinition, currentLevel: number): Partial<Resources> {
  const factor = def.costGrowth ** (currentLevel - 1)
  const cost: Partial<Resources> = {}
  for (const [key, amount] of Object.entries(def.baseCost) as [keyof Resources, number][]) {
    cost[key] = Math.round(amount * factor)
  }
  return cost
}

/** Duration in ms to take `currentLevel` to `currentLevel + 1`. */
export function getUpgradeDurationMs(def: BuildingDefinition, currentLevel: number): number {
  return def.baseDurationMs + def.durationGrowthMs * (currentLevel - 1)
}

export const SECT_HALL_ID = 'sectHall'

export const SECT_HALL_DEF: BuildingDefinition = {
  id: SECT_HALL_ID,
  name: 'Sect Hall',
  category: 'Core',
  description:
    "The seat of the Sect Master. No other building may be upgraded above the Sect Hall's level — it's the sect's default first investment.",
  baseCost: { spiritStones: 80, spiritWood: 20 },
  costGrowth: 1.6,
  baseDurationMs: 15_000,
  durationGrowthMs: 8_000,
}

export const BUILDING_DEFS: BuildingDefinition[] = [
  {
    id: 'treasury',
    name: 'Treasury',
    category: 'Production',
    description: "Generates Spirit Stones and sets the sect's Spirit Stone storage cap.",
    produces: 'spiritStones',
    baseRatePerLevel: 0.5,
    baseCost: { spiritStones: 60, spiritWood: 15 },
    costGrowth: 1.5,
    baseDurationMs: 12_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'spiritGarden',
    name: 'Spirit Garden',
    category: 'Production',
    description: 'Cultivates Spirit Herb.',
    produces: 'spiritHerb',
    baseRatePerLevel: 0.3,
    baseCost: { spiritStones: 50, spiritWood: 10 },
    costGrowth: 1.5,
    baseDurationMs: 12_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'spiritGrove',
    name: 'Spirit Grove',
    category: 'Production',
    description: 'Harvests Spirit Wood.',
    produces: 'spiritWood',
    baseRatePerLevel: 0.3,
    baseCost: { spiritStones: 50, ironEssence: 5 },
    costGrowth: 1.5,
    baseDurationMs: 12_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'ironVeinMine',
    name: 'Iron Vein Mine',
    category: 'Production',
    description: 'Extracts Iron Essence.',
    produces: 'ironEssence',
    baseRatePerLevel: 0.25,
    baseCost: { spiritStones: 55, spiritWood: 12 },
    costGrowth: 1.5,
    baseDurationMs: 13_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'sacredMountainShrine',
    name: 'Sacred Mountain Shrine',
    category: 'Production',
    description: "Draws Qi Stone from the mountain itself. Sets the sect's Qi Stone storage cap.",
    produces: 'qiStone',
    baseRatePerLevel: 0.2,
    baseCost: { spiritStones: 90, spiritWood: 15, ironEssence: 10 },
    costGrowth: 1.55,
    baseDurationMs: 16_000,
    durationGrowthMs: 7_000,
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    category: 'Support',
    description: 'Expands storage capacity for Raw Materials and Knowledge.',
    baseCost: { spiritStones: 70, spiritWood: 20 },
    costGrowth: 1.5,
    baseDurationMs: 14_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'dormitory',
    name: 'Dormitory',
    category: 'Support',
    description: "Houses disciples. Sets the sect's disciple capacity.",
    baseCost: { spiritStones: 65, spiritWood: 18 },
    costGrowth: 1.5,
    baseDurationMs: 13_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'trainingHall',
    name: 'Training Hall',
    category: 'Training',
    description: 'Trains assigned disciples, speeding up their cultivation progress.',
    baseCost: { spiritStones: 40, spiritWood: 10 },
    costGrowth: 1.4,
    baseDurationMs: 10_000,
    durationGrowthMs: 5_000,
  },
  {
    id: 'trainingGround',
    name: 'Training Ground',
    category: 'Training',
    description:
      "Spend Qi Stone and Spirit Herb to grant an assigned disciple a temporary Active Cultivation Boost — at the cost of the sect's passive Qi Stone production for the duration.",
    baseCost: { spiritStones: 45, spiritWood: 10 },
    costGrowth: 1.4,
    baseDurationMs: 10_000,
    durationGrowthMs: 5_000,
  },
  {
    id: 'library',
    name: 'Library',
    category: 'Knowledge',
    description: 'Generates Knowledge through study.',
    produces: 'knowledge',
    baseRatePerLevel: 0.25,
    baseCost: { spiritStones: 40, spiritWood: 10 },
    costGrowth: 1.4,
    baseDurationMs: 10_000,
    durationGrowthMs: 5_000,
  },
  {
    id: 'researchInstitute',
    name: 'Research Institute',
    category: 'Knowledge',
    description:
      "Conducts research projects that unlock permanent sect-wide bonuses — distinct from the Library's passive Knowledge generation.",
    baseCost: { spiritStones: 45, spiritWood: 12 },
    costGrowth: 1.4,
    baseDurationMs: 12_000,
    durationGrowthMs: 6_000,
  },
  {
    id: 'alchemyWorkshop',
    name: 'Alchemy Workshop',
    category: 'Crafting',
    // doc 07 §11 — Inscription/Artifact Restoration have no dedicated building at MVP scope, so their outputs (talismans, manuals) are folded in here. Referenced by craftingRecipes.ts.
    description: 'Brews pills, and crafts accessories and manuals.',
    baseCost: { spiritStones: 40, spiritWood: 10 },
    costGrowth: 1.4,
    baseDurationMs: 10_000,
    durationGrowthMs: 5_000,
  },
  {
    id: 'forge',
    name: 'Forge',
    category: 'Crafting',
    description: 'Smiths weapons and armor from Iron Essence and Spirit Wood.',
    baseCost: { spiritStones: 45, ironEssence: 15 },
    costGrowth: 1.4,
    baseDurationMs: 10_000,
    durationGrowthMs: 5_000,
  },
]

export function getBuildingDef(id: string): BuildingDefinition {
  if (id === SECT_HALL_ID) return SECT_HALL_DEF
  const def = BUILDING_DEFS.find((b) => b.id === id)
  if (!def) throw new Error(`Unknown building id: ${id}`)
  return def
}

export function getAllBuildingDefs(): BuildingDefinition[] {
  return [SECT_HALL_DEF, ...BUILDING_DEFS]
}
