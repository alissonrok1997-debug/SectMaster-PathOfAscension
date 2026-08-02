import type { ProvinceId, RegionId, Resources, SectSiteId, SectSiteTier, SiteModifierBundle } from '../../types'

/**
 * Sect Sites (FIRST_REALM_PLAN §1-§3). The First Realm replaces the old
 * 3-province/7-site founding-choice roster with 32 first-class, ownable sites:
 * 20 Poor (safe, never conquerable — founding + fallback), 10 Normal and 2 Good
 * (conquerable prestige seats). Founding only ever offers a free Poor site
 * (engine/world/founding.ts); climbing to Normal/Good is what Wave B's conquest
 * loop is for. Structural drawbacks stay in structural fields (buildingSlots),
 * not the multiplier bundle, so later content can't power-creep them away.
 */
export interface SectSiteDefinition {
  id: SectSiteId
  name: string
  description: string
  tier: SectSiteTier
  regionId: RegionId
  /** Poor sites are never conquerable (the safe founding/fallback pool, §1). */
  conquerable: boolean
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
 * reduced-slot sites, keeping their trade-off real without making any site a trap
 * that can't build (§15 pitfall #14).
 */
const BASELINE_BUILDING_SLOTS = 12

export const SECT_SITE_DEFS: SectSiteDefinition[] = [
  // ==================================================================
  // Spirit Mountain — cultivation-rich, constant conflict (1 Good, 3 Normal, 6 Poor)
  // ==================================================================
  {
    id: 'foothillHollow',
    name: 'Foothill Hollow',
    description: 'A quiet fold at the mountain\'s base — thin qi, but nobody bothers to take it from you.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.08, y: 0.85 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'stonebrookTerrace',
    name: 'Stonebrook Terrace',
    description: 'Terraced ground beside a cold mountain brook; unremarkable, but livable.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.06, y: 0.65 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 0,
    startingBonus: { spiritStones: 30 },
  },
  {
    id: 'windwardLedge',
    name: 'Windward Ledge',
    description: 'An exposed shelf that catches every mountain gale — cold, but the air carries faint qi.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.10, y: 0.45 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ cultivationSpeedMult: 1.05, defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'cragsideHamlet',
    name: 'Cragside Hamlet',
    description: 'A cluster of huts wedged between rockfaces; safe from wind, safe from ambition alike.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.05, y: 0.25 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85, upkeepMult: 0.95 }),
    travelUnitOffset: 0,
  },
  {
    id: 'drizzlingPines',
    name: 'Drizzling Pines',
    description: 'A damp pine slope, perpetually misted — nothing here draws attention.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.16, y: 0.80 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'lowerMistcliff',
    name: 'Lower Mistcliff',
    description: 'The mountain\'s lower shoulder, wrapped in permanent mist; a forgettable, forgiving start.',
    tier: 'poor',
    regionId: 'spiritMountain',
    conquerable: false,
    mapPosition: { x: 0.18, y: 0.60 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ cultivationSpeedMult: 1.05, defenceMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'cliffPlateau',
    name: 'Cliff Plateau',
    description: 'A defensible high shelf; the climb lengthens every journey out, but nobody climbs it uninvited.',
    tier: 'normal',
    regionId: 'spiritMountain',
    conquerable: true,
    mapPosition: { x: 0.20, y: 0.20 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 1.3, travelTimeMult: 1.2 }),
    travelUnitOffset: 1,
  },
  {
    id: 'hiddenValley',
    name: 'Hidden Valley',
    description: 'A sheltered fold in the peaks — dense spirit qi, but exposed to raiders who know the way in.',
    tier: 'normal',
    regionId: 'spiritMountain',
    conquerable: true,
    mapPosition: { x: 0.24, y: 0.38 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ cultivationSpeedMult: 1.15, defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'thundercrestRidge',
    name: 'Thundercrest Ridge',
    description: 'Lightning-scarred stone that hums with qi during every storm — a prize worth fighting over.',
    tier: 'normal',
    regionId: 'spiritMountain',
    conquerable: true,
    mapPosition: { x: 0.14, y: 0.15 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ cultivationSpeedMult: 1.1, productionMultByResource: { qiStone: 1.2 } }),
    travelUnitOffset: 1,
  },
  {
    id: 'sacredPeak',
    name: 'Sacred Peak',
    description: 'The mountain\'s crown — unmatched for cultivation, but there is little flat ground to build on, and every rival wants it.',
    tier: 'good',
    regionId: 'spiritMountain',
    conquerable: true,
    mapPosition: { x: 0.16, y: 0.06 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 4,
    modifiers: bundle({ cultivationSpeedMult: 1.4, defenceMult: 1.2, productionMultByResource: { qiStone: 1.3 } }),
    travelUnitOffset: 1,
    startingBonus: { qiStone: 50 },
  },

  // ==================================================================
  // Ancient Forest — rare herbs, beast threats (3 Normal, 5 Poor)
  // ==================================================================
  {
    id: 'mossbankClearing',
    name: 'Mossbank Clearing',
    description: 'A soft green clearing off the beaten path; herbs grow wild, but so does everything else.',
    tier: 'poor',
    regionId: 'ancientForest',
    conquerable: false,
    mapPosition: { x: 0.32, y: 0.85 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 0,
    startingBonus: { spiritHerb: 30 },
  },
  {
    id: 'fernwatchCamp',
    name: 'Fernwatch Camp',
    description: 'An old ranger\'s camp among the ferns — quiet, damp, easily overlooked.',
    tier: 'poor',
    regionId: 'ancientForest',
    conquerable: false,
    mapPosition: { x: 0.36, y: 0.68 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'willowbrookGlade',
    name: 'Willowbrook Glade',
    description: 'Weeping willows over a slow brook; a peaceful, unclaimed corner of the woods.',
    tier: 'poor',
    regionId: 'ancientForest',
    conquerable: false,
    mapPosition: { x: 0.30, y: 0.50 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ recruitmentRateMult: 1.1, defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'thistlewoodHollow',
    name: 'Thistlewood Hollow',
    description: 'Thorny undergrowth keeps most visitors out — including anyone looking for a fight.',
    tier: 'poor',
    regionId: 'ancientForest',
    conquerable: false,
    mapPosition: { x: 0.34, y: 0.30 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.9 }),
    travelUnitOffset: 0,
  },
  {
    id: 'duskleafMeadow',
    name: 'Duskleaf Meadow',
    description: 'A meadow that turns gold at dusk; low upkeep, low ambition.',
    tier: 'poor',
    regionId: 'ancientForest',
    conquerable: false,
    mapPosition: { x: 0.40, y: 0.88 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ upkeepMult: 0.9, defenceMult: 0.85 }),
    travelUnitOffset: 0,
  },
  {
    id: 'riverBasin',
    name: 'River Basin',
    description: 'Fertile floodplain — rich herb yields and easy travel along the waterways.',
    tier: 'normal',
    regionId: 'ancientForest',
    conquerable: true,
    mapPosition: { x: 0.44, y: 0.55 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ productionMultByResource: { spiritHerb: 1.2, spiritWood: 1.1 }, travelTimeMult: 0.9 }),
    travelUnitOffset: 0,
    startingBonus: { spiritHerb: 40 },
  },
  {
    id: 'elderwoodSanctum',
    name: 'Elderwood Sanctum',
    description: 'An old-growth grove around a moss-covered shrine; timber and quiet authority in equal measure.',
    tier: 'normal',
    regionId: 'ancientForest',
    conquerable: true,
    mapPosition: { x: 0.48, y: 0.35 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ productionMultByResource: { spiritWood: 1.25 }, buildTimeMult: 0.9 }),
    travelUnitOffset: 0,
  },
  {
    id: 'mistfenHollow',
    name: 'Mistfen Hollow',
    description: 'A quiet, mist-wreathed hollow that draws wandering cultivators and keeps upkeep low.',
    tier: 'normal',
    regionId: 'ancientForest',
    conquerable: true,
    mapPosition: { x: 0.42, y: 0.15 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 1,
    modifiers: bundle({ recruitmentRateMult: 1.15, upkeepMult: 0.9 }),
    travelUnitOffset: 0,
  },

  // ==================================================================
  // Desert — minerals, dangerous travel (2 Normal, 5 Poor)
  // ==================================================================
  {
    id: 'sunbleachedCamp',
    name: 'Sunbleached Camp',
    description: 'A wind-scoured campsite baking under an unforgiving sun; nothing worth raiding for.',
    tier: 'poor',
    regionId: 'desert',
    conquerable: false,
    mapPosition: { x: 0.56, y: 0.80 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85, upkeepMult: 1.05 }),
    travelUnitOffset: 1,
  },
  {
    id: 'dunesEdgeOutpost',
    name: "Dune's Edge Outpost",
    description: 'A trader\'s waystation at the desert\'s rim — modest, dusty, easily missed.',
    tier: 'poor',
    regionId: 'desert',
    conquerable: false,
    mapPosition: { x: 0.60, y: 0.60 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'crackedBasin',
    name: 'Cracked Basin',
    description: 'A dry lakebed of cracked clay; harsh, flat, and forgettable.',
    tier: 'poor',
    regionId: 'desert',
    conquerable: false,
    mapPosition: { x: 0.58, y: 0.40 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'windscourFlat',
    name: 'Windscour Flat',
    description: 'Sand-scoured flatland where the wind never stops — punishing, but nobody wants it either.',
    tier: 'poor',
    regionId: 'desert',
    conquerable: false,
    mapPosition: { x: 0.64, y: 0.85 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85, upkeepMult: 1.05 }),
    travelUnitOffset: 1,
  },
  {
    id: 'ashdryWells',
    name: 'Ashdry Wells',
    description: 'A cluster of brackish wells near cooled ash-flats; barely enough to sustain a young sect.',
    tier: 'poor',
    regionId: 'desert',
    conquerable: false,
    mapPosition: { x: 0.68, y: 0.65 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'cinderTerrace',
    name: 'Cinder Terrace',
    description: 'Volcanic terraces rich in metal essence, where the heat speeds every forge.',
    tier: 'normal',
    regionId: 'desert',
    conquerable: true,
    mapPosition: { x: 0.72, y: 0.45 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ productionMultByResource: { ironEssence: 1.25 }, buildTimeMult: 0.85 }),
    travelUnitOffset: 1,
  },
  {
    id: 'obsidianSpire',
    name: 'Obsidian Spire',
    description: 'A glassy spire of hardened lava — a strong, harsh perch for a sect, long eyed by the Bloodmoon Cult.',
    tier: 'normal',
    regionId: 'desert',
    conquerable: true,
    mapPosition: { x: 0.66, y: 0.20 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 2,
    modifiers: bundle({ cultivationSpeedMult: 1.1, defenceMult: 1.15, productionMultByResource: { spiritStones: 1.15 } }),
    travelUnitOffset: 2,
  },

  // ==================================================================
  // Forgotten Ruins — high-risk/high-reward, exploration comes later (1 Good, 2 Normal, 4 Poor)
  // ==================================================================
  {
    id: 'bonepaleCrossing',
    name: 'Bonepale Crossing',
    description: 'A weathered crossroads of bleached stone; too picked-over to be worth conquering.',
    tier: 'poor',
    regionId: 'forgottenRuins',
    conquerable: false,
    mapPosition: { x: 0.82, y: 0.75 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 2,
  },
  {
    id: 'shatteredArchway',
    name: 'Shattered Archway',
    description: 'The collapsed gate of some older structure; a rough but livable foothold in the ruins.',
    tier: 'poor',
    regionId: 'forgottenRuins',
    conquerable: false,
    mapPosition: { x: 0.86, y: 0.55 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 2,
  },
  {
    id: 'sunkenCauseway',
    name: 'Sunken Causeway',
    description: 'A half-submerged stone road leading nowhere in particular; quiet, and no one contests it.',
    tier: 'poor',
    regionId: 'forgottenRuins',
    conquerable: false,
    mapPosition: { x: 0.80, y: 0.35 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 2,
  },
  {
    id: 'greyReliquary',
    name: 'Grey Reliquary',
    description: 'A looted reliquary, its treasures long gone — safe now, precisely because it has nothing left.',
    tier: 'poor',
    regionId: 'forgottenRuins',
    conquerable: false,
    mapPosition: { x: 0.90, y: 0.85 },
    buildingSlots: BASELINE_BUILDING_SLOTS,
    modifiers: bundle({ defenceMult: 0.85 }),
    travelUnitOffset: 2,
  },
  {
    id: 'wraithbindHollow',
    name: 'Wraithbind Hollow',
    description: 'A hollow thick with restless qi; unsettling to live in, but potent for those who can hold it.',
    tier: 'normal',
    regionId: 'forgottenRuins',
    conquerable: true,
    mapPosition: { x: 0.92, y: 0.60 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 1,
    modifiers: bundle({ cultivationSpeedMult: 1.15, defenceMult: 1.1 }),
    travelUnitOffset: 2,
  },
  {
    id: 'silentNecropolis',
    name: 'Silent Necropolis',
    description: 'A city of the dead, stripped of its guardians — rich in salvage for whoever can defend it.',
    tier: 'normal',
    regionId: 'forgottenRuins',
    conquerable: true,
    mapPosition: { x: 0.88, y: 0.20 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 1,
    modifiers: bundle({ productionMultByResource: { spiritStones: 1.2 }, defenceMult: 1.1 }),
    travelUnitOffset: 3,
  },
  {
    id: 'obsidianThrone',
    name: 'Obsidian Throne',
    description: 'The deepest, oldest seat of power in the Forgotten Ruins — every ambitious sect\'s final target.',
    tier: 'good',
    regionId: 'forgottenRuins',
    conquerable: true,
    mapPosition: { x: 0.94, y: 0.40 },
    buildingSlots: BASELINE_BUILDING_SLOTS - 3,
    modifiers: bundle({ cultivationSpeedMult: 1.35, defenceMult: 1.3, productionMultByResource: { spiritStones: 1.3 } }),
    travelUnitOffset: 3,
  },
]

export function getSectSiteDef(id: SectSiteId): SectSiteDefinition {
  const def = SECT_SITE_DEFS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown sect site id: ${id}`)
  return def
}

export function getSectSitesForProvince(provinceId: ProvinceId): SectSiteDefinition[] {
  // Single-province world (§1) — every site belongs to `firstRealm`; kept as a
  // function (rather than inlining SECT_SITE_DEFS everywhere) so a future
  // multi-province wave is a one-line change here, not a call-site hunt.
  return provinceId === 'firstRealm' ? SECT_SITE_DEFS : []
}

export function getSectSitesByTier(tier: SectSiteTier): SectSiteDefinition[] {
  return SECT_SITE_DEFS.filter((s) => s.tier === tier)
}

export function getSectSitesByRegion(regionId: RegionId): SectSiteDefinition[] {
  return SECT_SITE_DEFS.filter((s) => s.regionId === regionId)
}
