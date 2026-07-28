import type { GameState, Resources } from '../types'
import { getResearchStorageCapMultiplier } from './research'

/**
 * Storage caps (doc 01, Section 6). Production throttles at cap rather
 * than deleting overflow. Each resource's cap is driven by the building
 * that logically governs it; raw materials and Knowledge share the
 * Warehouse until dedicated storage exists for them. Research (doc 10 §3
 * "Improved storage") applies a flat multiplier on top.
 */
export function computeStorageCaps(state: GameState): Resources {
  const buildings = state.buildings
  const treasuryLevel = buildings.treasury?.level ?? 0
  const shrineLevel = buildings.sacredMountainShrine?.level ?? 0
  const warehouseLevel = buildings.warehouse?.level ?? 0
  const researchMult = getResearchStorageCapMultiplier(state)

  return {
    spiritStones: (500 + treasuryLevel * 400) * researchMult,
    qiStone: (300 + shrineLevel * 250) * researchMult,
    spiritWood: (200 + warehouseLevel * 150) * researchMult,
    ironEssence: (200 + warehouseLevel * 150) * researchMult,
    spiritHerb: (200 + warehouseLevel * 150) * researchMult,
    knowledge: (200 + warehouseLevel * 100) * researchMult,
  }
}
