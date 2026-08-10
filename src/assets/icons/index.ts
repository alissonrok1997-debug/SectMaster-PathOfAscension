/**
 * Art registry for the sliced icon sheets.
 *
 * Each map is keyed by the id the rest of the game already uses (resource key,
 * building id, DiscipleRole, EquipmentSlotId) so lookups need no translation
 * layer. A building with no artwork is simply absent from BUILDING_ART —
 * `GameIcon` renders the emoji fallback passed by the call site for those.
 *
 * Files are produced from `src/assets/*Icon.png` (magenta chroma-keyed, sliced,
 * trimmed to a square, quantised). `_alt-*.png` are unused near-duplicates kept
 * on disk for future tiers.
 */
import type { DiscipleRole, EquipmentSlotId, Resources } from '../../game/types'

import ironEssenceArt from './resources/ironEssence.png'
import knowledgeArt from './resources/knowledge.png'
import qiStoneArt from './resources/qiStone.png'
import spiritHerbArt from './resources/spiritHerb.png'
import spiritStonesArt from './resources/spiritStones.png'
import spiritWoodArt from './resources/spiritWood.png'

import alchemyWorkshopArt from './buildings/alchemyWorkshop.png'
import dormitoryArt from './buildings/dormitory.png'
import forgeArt from './buildings/forge.png'
import ironVeinMineArt from './buildings/ironVeinMine.png'
import libraryArt from './buildings/library.png'
import researchInstituteArt from './buildings/researchInstitute.png'
import sacredMountainShrineArt from './buildings/sacredMountainShrine.png'
import sectHallArt from './buildings/sectHall.png'
import spiritGardenArt from './buildings/spiritGarden.png'
import spiritGroveArt from './buildings/spiritGrove.png'
import trainingGroundArt from './buildings/trainingGround.png'
import trainingHallArt from './buildings/trainingHall.png'
import treasuryArt from './buildings/treasury.png'
import warehouseArt from './buildings/warehouse.png'

import alchemistArt from './roles/Alchemist.png'
import blacksmithArt from './roles/Blacksmith.png'
import combatantArt from './roles/Combatant.png'
import scholarArt from './roles/Scholar.png'

import accessory1Art from './slots/accessory1.png'
import accessory2Art from './slots/accessory2.png'
import bodyArmorArt from './slots/bodyArmor.png'
import weaponArt from './slots/weapon.png'

export const RESOURCE_ART: Record<keyof Resources, string> = {
  spiritStones: spiritStonesArt,
  qiStone: qiStoneArt,
  spiritWood: spiritWoodArt,
  ironEssence: ironEssenceArt,
  spiritHerb: spiritHerbArt,
  knowledge: knowledgeArt,
}

/** Covers every building in BUILDING_DEFS; keep in sync when adding a building. */
export const BUILDING_ART: Record<string, string | undefined> = {
  sectHall: sectHallArt,
  treasury: treasuryArt,
  spiritGarden: spiritGardenArt,
  spiritGrove: spiritGroveArt,
  ironVeinMine: ironVeinMineArt,
  sacredMountainShrine: sacredMountainShrineArt,
  warehouse: warehouseArt,
  dormitory: dormitoryArt,
  trainingHall: trainingHallArt,
  trainingGround: trainingGroundArt,
  library: libraryArt,
  researchInstitute: researchInstituteArt,
  alchemyWorkshop: alchemyWorkshopArt,
  forge: forgeArt,
}

export const ROLE_ART: Record<DiscipleRole, string> = {
  Combatant: combatantArt,
  Alchemist: alchemistArt,
  Blacksmith: blacksmithArt,
  Scholar: scholarArt,
}

export const SLOT_ART: Record<EquipmentSlotId, string> = {
  weapon: weaponArt,
  bodyArmor: bodyArmorArt,
  accessory1: accessory1Art,
  accessory2: accessory2Art,
}
