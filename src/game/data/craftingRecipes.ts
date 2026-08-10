import type { Resources } from '../types'

export interface CraftingRecipe {
  id: string
  itemDefId: string
  /** doc 07 §11's two MVP disciplines (Inscription/Artifact Restoration are out of scope — see buildingDefs.ts's Alchemy Workshop note). */
  discipline: 'Alchemy' | 'Forging'
  requiredBuildingId: string
  cost: Partial<Resources>
  /**
   * CRAFTING_RECIPE_PACK §8 crafting materials this recipe also consumes, keyed by
   * material def id (data/materialDefs.ts). Absent for recipes that use only the
   * six core resources. Charged upfront alongside `cost`, scaled by batch quantity.
   */
  materialCost?: Record<string, number>
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
    id: 'craftJadePendant',
    itemDefId: 'jadePendant',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 25, spiritHerb: 10 },
    durationMs: 18_000,
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

  // --- Crafting Recipe Pack, Phase 1: pure-data equipment & pills (CRAFTING_RECIPE_PACK.md §3-6) ---
  // Weapons (Forging)
  {
    id: 'craftCloudpiercerSpear',
    itemDefId: 'cloudpiercerSpear',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 130, spiritWood: 70, spiritStones: 45 },
    durationMs: 55_000,
  },
  {
    id: 'craftNineRingSaber',
    itemDefId: 'nineRingSaber',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 175, spiritStones: 60 },
    durationMs: 70_000,
  },
  // Armor (Forging)
  {
    id: 'craftScaledSpiritMail',
    itemDefId: 'scaledSpiritMail',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 120, spiritWood: 60, spiritStones: 55 },
    durationMs: 55_000,
  },
  {
    id: 'craftCloudweaveRobe',
    itemDefId: 'cloudweaveRobe',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritWood: 130, spiritHerb: 60, spiritStones: 40 },
    durationMs: 40_000,
  },
  // Accessories (Alchemy)
  {
    id: 'craftSpiritGatheringPendant',
    itemDefId: 'spiritGatheringPendant',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 140, qiStone: 70, spiritHerb: 30 },
    durationMs: 50_000,
  },
  {
    id: 'craftCinnabarWardTalisman',
    itemDefId: 'cinnabarWardTalisman',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 90, spiritHerb: 80, knowledge: 60 },
    durationMs: 45_000,
  },
  // Pills — healing line
  {
    id: 'brewSwiftMendingPowder',
    itemDefId: 'swiftMendingPowder',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritHerb: 12, spiritStones: 6 },
    durationMs: 8_000,
  },
  {
    id: 'brewJadeDewPill',
    itemDefId: 'jadeDewPill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritHerb: 55, spiritStones: 40 },
    durationMs: 28_000,
  },
  // Pills — cultivation line
  {
    id: 'brewSpiritConvergencePill',
    itemDefId: 'spiritConvergencePill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 45, spiritHerb: 30 },
    durationMs: 25_000,
  },
  {
    id: 'brewMarrowCleansingPill',
    itemDefId: 'marrowCleansingPill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 100, spiritHerb: 70, spiritStones: 60 },
    durationMs: 50_000,
  },

  // --- Crafting Recipe Pack, Phase 2: manuals (CRAFTING_RECIPE_PACK.md §7) ---
  {
    id: 'transcribeSaberManual',
    itemDefId: 'saberManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 55, spiritStones: 65 },
    durationMs: 35_000,
  },
  {
    id: 'transcribeSpearManual',
    itemDefId: 'spearManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 110, spiritStones: 120 },
    durationMs: 60_000,
  },
  {
    id: 'transcribeIronPalmManual',
    itemDefId: 'ironPalmManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 100, spiritStones: 90, spiritHerb: 50 },
    durationMs: 55_000,
  },
  {
    id: 'transcribeBodyTemperingManual',
    itemDefId: 'bodyTemperingManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 200, spiritStones: 180, ironEssence: 100 },
    durationMs: 100_000,
  },

  // --- Crafting Recipe Pack, Phase 3: material-gated recipes (CRAFTING_RECIPE_PACK.md §3-7) ---
  // These also consume new crafting materials (materialCost) with no acquisition source yet.
  // Weapons (Forging)
  {
    id: 'craftFrostveinJian',
    itemDefId: 'frostveinJian',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 90, spiritStones: 70 },
    materialCost: { frostveinOre: 12 },
    durationMs: 60_000,
  },
  {
    id: 'craftThunderchaseBlade',
    itemDefId: 'thunderchaseBlade',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 180, spiritStones: 150 },
    materialCost: { skyfallIron: 20, thunderStruckWood: 15 },
    durationMs: 110_000,
  },
  {
    id: 'craftCoilingSerpentWhip',
    itemDefId: 'coilingSerpentWhip',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritWood: 140, spiritStones: 160 },
    materialCost: { serpentSinew: 25 },
    durationMs: 95_000,
  },
  {
    id: 'craftDuskfallGuandao',
    itemDefId: 'duskfallGuandao',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 260, spiritWood: 120 },
    materialCost: { skyfallIron: 25 },
    durationMs: 130_000,
  },
  {
    id: 'craftNinefoldAscensionSword',
    itemDefId: 'ninefoldAscensionSword',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 350, spiritStones: 300 },
    materialCost: { dragonboneSteel: 30, starfallEssence: 10 },
    durationMs: 240_000,
  },
  // Armor (Forging)
  {
    id: 'craftStoneheartCuirass',
    itemDefId: 'stoneheartCuirass',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { ironEssence: 150, spiritStones: 50 },
    materialCost: { earthheartJade: 10 },
    durationMs: 70_000,
  },
  {
    id: 'craftGoldenBellVestment',
    itemDefId: 'goldenBellVestment',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritStones: 220, spiritHerb: 120 },
    materialCost: { goldsheenSilk: 30 },
    durationMs: 110_000,
  },
  {
    id: 'craftFrostveilMantle',
    itemDefId: 'frostveilMantle',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritWood: 180, spiritStones: 160 },
    materialCost: { frostveinOre: 35 },
    durationMs: 100_000,
  },
  {
    id: 'craftNineHeavensFeatherRaiment',
    itemDefId: 'nineHeavensFeatherRaiment',
    discipline: 'Forging',
    requiredBuildingId: 'forge',
    cost: { spiritStones: 380, spiritHerb: 200 },
    materialCost: { goldsheenSilk: 60, phoenixPlume: 5 },
    durationMs: 240_000,
  },
  // Accessories (Alchemy)
  {
    id: 'craftEyeOfTheStillLake',
    itemDefId: 'eyeOfTheStillLake',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 240, qiStone: 140 },
    materialCost: { moonwellWater: 20 },
    durationMs: 105_000,
  },
  {
    id: 'craftAncestralJadeSeal',
    itemDefId: 'ancestralJadeSeal',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 260, knowledge: 130 },
    materialCost: { ancestralJade: 15 },
    durationMs: 120_000,
  },
  {
    id: 'craftHeartOfTheSleepingDragon',
    itemDefId: 'heartOfTheSleepingDragon',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { spiritStones: 420, qiStone: 300 },
    materialCost: { dragonHeartblood: 8, ancestralJade: 30 },
    durationMs: 240_000,
  },
  // Pill (Alchemy)
  {
    id: 'brewFoundationEstablishmentPill',
    itemDefId: 'foundationEstablishmentPill',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { qiStone: 200, spiritHerb: 150, spiritStones: 180 },
    materialCost: { millennialGinseng: 10 },
    durationMs: 110_000,
  },
  // Manual (Alchemy)
  {
    id: 'transcribeFlyingSwordManual',
    itemDefId: 'flyingSwordManual',
    discipline: 'Alchemy',
    requiredBuildingId: 'alchemyWorkshop',
    cost: { knowledge: 380, spiritStones: 320 },
    materialCost: { starfallEssence: 12 },
    durationMs: 200_000,
  },
]

export function getRecipe(id: string): CraftingRecipe {
  const recipe = CRAFTING_RECIPES.find((r) => r.id === id)
  if (!recipe) throw new Error(`Unknown recipe id: ${id}`)
  return recipe
}
