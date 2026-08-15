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

import portraitCombatantA from './disciples/Combatant_A.png'
import portraitCombatantB from './disciples/Combatant_B.png'
import portraitCombatantC from './disciples/Combatant_C.png'
import portraitAlchemistA from './disciples/Alchemist_A.png'
import portraitAlchemistB from './disciples/Alchemist_B.png'
import portraitAlchemistC from './disciples/Alchemist_C.png'
import portraitBlacksmithA from './disciples/Blacksmith_A.png'
import portraitBlacksmithB from './disciples/Blacksmith_B.png'
import portraitBlacksmithC from './disciples/Blacksmith_C.png'
import portraitScholarA from './disciples/Scholar_A.png'
import portraitScholarB from './disciples/Scholar_B.png'
import portraitScholarC from './disciples/Scholar_C.png'

import tabBuildingsArt from './tabs/buildings.png'
import tabDisciplesArt from './tabs/disciples.png'
import tabMissionsArt from './tabs/missions.png'
import tabMoonArt from './tabs/moon.png'
import tabReportsArt from './tabs/reports.png'
import tabResearchArt from './tabs/research.png'
import tabSectArt from './tabs/sect.png'
import tabSunArt from './tabs/sun.png'
import tabSystemArt from './tabs/system.png'
import tabWorkshopArt from './tabs/workshop.png'
import tabWorldArt from './tabs/world.png'

import emberArt from './parchment/ember.png'

import emblemArt from './sect/emblem.png'
import sealArt from './sect/seal.png'

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

/**
 * Disciple portraits (§16.2) — three per role, grade deliberately absent from the artwork
 * because `.disciple-portrait`'s frame carries it. `DisciplePortrait` picks a variant by
 * hashing the disciple id, so a disciple's face is stable without a stored portrait field.
 */
export const PORTRAIT_ART: Record<DiscipleRole, string[]> = {
  Combatant: [portraitCombatantA, portraitCombatantB, portraitCombatantC],
  Alchemist: [portraitAlchemistA, portraitAlchemistB, portraitAlchemistC],
  Blacksmith: [portraitBlacksmithA, portraitBlacksmithB, portraitBlacksmithC],
  Scholar: [portraitScholarA, portraitScholarB, portraitScholarC],
}

export const SLOT_ART: Record<EquipmentSlotId, string> = {
  weapon: weaponArt,
  bodyArmor: bodyArmorArt,
  accessory1: accessory1Art,
  accessory2: accessory2Art,
}

/**
 * Tab bar and world-clock chrome art (GAME_UI_DESIGN_SYSTEM §15 exception, §23). Keyed by
 * `ScreenTabId` plus `sun`/`moon`; all nine tabs are covered. `UiIcon` still falls back to
 * its SVG glyph for any name absent here — same pattern as BUILDING_ART — so a missing or
 * failed asset degrades instead of breaking.
 */
export const TAB_ART: Record<string, string | undefined> = {
  sect: tabSectArt,
  buildings: tabBuildingsArt,
  disciples: tabDisciplesArt,
  missions: tabMissionsArt,
  workshop: tabWorkshopArt,
  research: tabResearchArt,
  world: tabWorldArt,
  reports: tabReportsArt,
  system: tabSystemArt,
  sun: tabSunArt,
  moon: tabMoonArt,
}

/**
 * The sect's own mark (brief A12, §18's missing insignia).
 *
 * `EMBLEM_ART` is the emblem proper — a jade peak rising from gold-ringed qi. It is the
 * same source image as `public/icons/source-1024.png`, so the mark in the hero and the
 * mark on the player's home screen are one symbol. 256px: `.sect-hero-crest` renders it
 * at 56px and clips it to a circle itself, so no alpha channel is needed.
 *
 * `SEAL_ART` is the ornate variant — the emblem inside a wreath and outer seal ring. It
 * carries too much detail to survive a 56px crest (verified by rendering: the peak is
 * gone by 192px), so it is reserved for large-format use only — a founding-screen ground
 * or the low-opacity stamp behind a battle report. It keeps its alpha for that.
 */
export const EMBLEM_ART = emblemArt
export const SEAL_ART = sealArt

/**
 * The Combat Power ember (Set E). Replaces the hand-authored `.cp-glyph` SVG in
 * `DiscipleCard` — the flame is depicted, not operated, so §23's "ask for the asset" rule
 * routes it to art. Its aspect is 0.699, so it is sized by CSS rather than `GameIcon`,
 * which forces a square box.
 */
export const EMBER_ART = emberArt
