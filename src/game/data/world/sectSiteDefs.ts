import type { Resources, SectSiteId, ProvinceId, SiteModifierBundle } from '../../types'

/**
 * Sect Sites (WORLD_MAP_DESIGN §4). Each province offers a handful of sites; the
 * founding choice picks one, permanently colouring the save with its modifier
 * bundle and building-slot cap. Structural drawbacks belong in structural fields
 * (Sacred Peak pays for its cultivation bonus with fewer `buildingSlots`), not in
 * the multiplier bundle where later content could power-creep them away (§4.2).
 */
export interface SectSiteDefinition {
  id: SectSiteId
  provinceId: ProvinceId
  name: string
  description: string
  mapPosition: { x: number; y: number }
  buildingSlots: number
  modifiers: SiteModifierBundle
  travelUnitOffset: number
  startingBonus?: Partial<Resources>
}

/** Fills every SiteModifierBundle field to its identity default (1 / empty), so a site only spells out what it changes. */
function bundle(partial: Partial<SiteModifierBundle>): SiteModifierBundle {
  return {
    cultivationSpeedMult: 1,
    productionMultByResource: {},
    defenceMult: 1,
    travelTimeMult: 1,
    recruitmentRateMult: 1,
    upkeepMult: 1,
    buildTimeMult: 1,
    ...partial,
  }
}

/**
 * Baseline building-slot cap (§4.3). The game has 5 core + up to 6 specialization
 * buildings = 11 max, so a baseline of 12 never binds — the cap only bites at
 * reduced-slot sites (Sacred Peak, Obsidian Spire), keeping their trade-off real
 * without making any site a trap that can't build (§15 pitfall #14).
 */
const BASELINE_BUILDING_SLOTS = 12

export const SECT_SITE_DEFS: SectSiteDefinition[] = [
  // --- Azure Mountains ---
  {
    id: 'hiddenValley',
    provinceId: 'azureMountains',
    name: 'Hidden Valley',
    description: 'A sheltered fold in the peaks — dense spirit qi, but exposed to raids.',
    mapPosition: { x: 0.3, y: 0.4 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ cultivationSpeedMult: 1.15, defenceMult: 0.8 }),
    travelUnitOffset: 0,
  },
  {
    id: 'cliffPlateau',
    provinceId: 'azureMountains',
    name: 'Cliff Plateau',
    description: 'A defensible high shelf; the climb lengthens every journey out.',
    mapPosition: { x: 0.2, y: 0.25 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 1.3, travelTimeMult: 1.2 }),
    travelUnitOffset: 1,
  },
  {
    id: 'sacredPeak',
    provinceId: 'azureMountains',
    name: 'Sacred Peak',
    description: 'The mountain\'s crown — unmatched for cultivation, but there is little flat ground to build on.',
    mapPosition: { x: 0.28, y: 0.15 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 4,
    modifiers: bundle({ cultivationSpeedMult: 1.3 }),
    travelUnitOffset: 0,
    startingBonus: { qiStone: 50 },
  },
  // --- Verdant Basin ---
  {
    id: 'riverBasin',
    provinceId: 'verdantBasin',
    name: 'River Basin',
    description: 'Fertile floodplain — rich herb yields and easy travel along the waterways.',
    mapPosition: { x: 0.5, y: 0.55 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ productionMultByResource: { spiritHerb: 1.2, spiritWood: 1.1 }, travelTimeMult: 0.9 }),
    travelUnitOffset: 0,
    startingBonus: { spiritHerb: 40 },
  },
  {
    id: 'mistfenHollow',
    provinceId: 'verdantBasin',
    name: 'Mistfen Hollow',
    description: 'A quiet, mist-wreathed hollow that draws wandering cultivators and keeps upkeep low.',
    mapPosition: { x: 0.58, y: 0.45 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 1,
    modifiers: bundle({ recruitmentRateMult: 1.15, upkeepMult: 0.9 }),
    travelUnitOffset: 0,
  },
  // --- Ember Wastes ---
  {
    id: 'cinderTerrace',
    provinceId: 'emberWastes',
    name: 'Cinder Terrace',
    description: 'Volcanic terraces rich in metal essence, where the heat speeds every forge.',
    mapPosition: { x: 0.75, y: 0.62 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ productionMultByResource: { ironEssence: 1.25 }, buildTimeMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'obsidianSpire',
    provinceId: 'emberWastes',
    name: 'Obsidian Spire',
    description: 'A glassy spire of hardened lava — a strong, harsh perch for a sect.',
    mapPosition: { x: 0.82, y: 0.5 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 2,
    modifiers: bundle({ cultivationSpeedMult: 1.1, defenceMult: 1.15 }),
    travelUnitOffset: 1,
  },
]

export function getSectSiteDef(id: SectSiteId): SectSiteDefinition {
  const def = SECT_SITE_DEFS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown sect site id: ${id}`)
  return def
}

export function getSectSitesForProvince(provinceId: ProvinceId): SectSiteDefinition[] {
  return SECT_SITE_DEFS.filter((s) => s.provinceId === provinceId)
}
