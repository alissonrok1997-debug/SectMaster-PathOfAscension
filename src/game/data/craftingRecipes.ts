import type { Resources } from '../types'

export interface CraftingRecipe {
  id: string
  itemDefId: string
  /** doc 07 §11's two MVP disciplines (Inscription/Artifact Restoration are out of scope — see buildingDefs.ts's Alchemy Workshop note). */
  discipline: 'Alchemy' | 'Forging'
  requiredBuildingId: string
  cost: Partial<Resources>
  durationMs: number
}

/**
 * MVP crafting pool — dev-placeholder scale durations/costs (tens of
 * seconds, tens of resources), same convention as every other wave's
 * tuning. This data file, together with `itemDefs.ts`, is this prototype's
 * "crafting/economy balancing spreadsheet" — numbers live in code, not a
 * separate document, consistent with how every prior wave's tuning has
 * been kept in `data/` files.
 */
export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craftIronSword',
    itemDefId: 'ironSword',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 30, spiritWood: 10 },
    durationMs: 20_000,
  },
  {
    id: 'craftSpiritIronSword',
    itemDefId: 'spiritIronSword',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 60, spiritStones: 40 },
    durationMs: 30_000,
  },
  {
    id: 'craftClothRobe',
    itemDefId: 'clothRobe',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritWood: 25, spiritHerb: 5 },
    durationMs: 18_000,
  },
  {
    id: 'craftLeatherVest',
    itemDefId: 'leatherVest',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 25, spiritWood: 20 },
    durationMs: 25_000,
  },
  {
    id: 'craftJadeRing',
    itemDefId: 'jadeRing',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 30, qiStone: 10 },
    durationMs: 15_000,
  },
  {
    id: 'craftTalismanOfVigor',
    itemDefId: 'talismanOfVigor',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 20, spiritHerb: 15 },
    durationMs: 22_000,
  },
  {
    id: 'brewMinorHealingPill',
    itemDefId: 'minorHealingPill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritHerb: 20, spiritStones: 15 },
    durationMs: 15_000,
  },
  {
    id: 'brewQiReplenishmentPill',
    itemDefId: 'qiReplenishmentPill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 25, spiritHerb: 10 },
    durationMs: 15_000,
  },
  {
    id: 'transcribeSwordManual',
    itemDefId: 'swordManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 50, spiritStones: 60 },
    durationMs: 35_000,
  },
]

export function getRecipe(id: string): CraftingRecipe {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === id)
  if (!recipe) throw new Error(`Unknown recipe id: ${id}`)
  return recipe
}
