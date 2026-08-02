import type {
  ExplorationArchetypeId,
  LocationDiscoveryRule,
  LocationId,
  MapPosition,
  OutpostUpgradePath,
  ProvinceId,
  Resources,
  ResourceArchetypeId,
} from '../../types'

/**
 * Handcrafted named locations (FIRST_REALM_PLAN §3 / §3b). A landmark
 * references an archetype for its mechanics and only states its own specifics
 * (name, distance, danger, yields). The First Realm hand-authors all 52
 * resource nodes here rather than through the procedural generator
 * (engine/world/worldGeneration.ts) — with a single province, region identity
 * (Spirit Mountain / Ancient Forest / Desert / Forgotten Ruins) is easier to
 * express as hand-placed clusters than generator weights.
 *
 * Exploration locations (ruins, secret sites) are deferred (FIRST_REALM_PLAN
 * §11) — no fog of war exists yet, so there is nothing to explore. The type is
 * kept so that later wave is pure data, no engine change.
 */
export interface ResourceLocationDefinition {
  id: LocationId
  kind: 'resource'
  provinceId: ProvinceId
  name: string
  archetypeId: ResourceArchetypeId
  /** Base payload for one full on-site gather cycle. */
  yieldPerVisit: Partial<Resources>
  /** Total cycles before depletion; Infinity allowed. */
  capacity: number
  /** Cycles restored per world-clock day; omitted = no regeneration. */
  regenPerDay?: number
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
  isLandmark: boolean
  /** Present only on locations that can be turned into a passive-yield outpost (§5.3); absent = not claimable. */
  upgradePath?: OutpostUpgradePath
}

export interface ExplorationLocationDefinition {
  id: LocationId
  kind: 'exploration'
  provinceId: ProvinceId
  name: string
  archetypeId: ExplorationArchetypeId
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
  /** 0–1 knowledge added per completed visit (§6.3). */
  knowledgePerVisit: number
  discoveryRule: LocationDiscoveryRule
  /** Key into the exploration reward tables authored in a later phase (§6.2). */
  rewardTableId: string
  isLandmark: boolean
}

export type LocationDefinition = ResourceLocationDefinition | ExplorationLocationDefinition

/** Authoring shape for a resource node — trims the boilerplate the 52-node roster would otherwise repeat. */
interface NodeSpec {
  id: string
  name: string
  archetypeId: ResourceArchetypeId
  yieldPerVisit: Partial<Resources>
  capacity: number
  regenPerDay?: number
  dangerTier: number
  travelUnits: number
  mapPosition: MapPosition
  maxParty: number
  onSiteDurationMs: number
  /** Present only for nodes claimable as a passive outpost (§4.2). */
  claim?: OutpostUpgradePath['level1']
}

function node(spec: NodeSpec): ResourceLocationDefinition {
  return {
    id: spec.id,
    kind: 'resource',
    provinceId: 'firstRealm',
    name: spec.name,
    archetypeId: spec.archetypeId,
    yieldPerVisit: spec.yieldPerVisit,
    capacity: spec.capacity,
    regenPerDay: spec.regenPerDay,
    dangerTier: spec.dangerTier,
    travelUnits: spec.travelUnits,
    mapPosition: spec.mapPosition,
    maxParty: spec.maxParty,
    onSiteDurationMs: spec.onSiteDurationMs,
    isLandmark: true,
    upgradePath: spec.claim ? { level1: spec.claim } : undefined,
  }
}

export const LANDMARK_DEFS: LocationDefinition[] = [
  // ==================================================================
  // Spirit Mountain — 16 nodes (cultivation-rich: Qi Stone + Iron Essence + Spirit Stones)
  // ==================================================================
  node({ id: 'firstRealm.frostglowCrystalCave', name: 'Frostglow Crystal Cave', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 10 }, capacity: 30, regenPerDay: 3, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.12, y: 0.50 }, maxParty: 2, onSiteDurationMs: 20_000, claim: { claimCost: { spiritStones: 300, qiStone: 20 }, requiredReputation: 35, claimDurationMs: 45_000, bonus: { productionMultByResource: { qiStone: 1.25 } } } }),
  node({ id: 'firstRealm.whisperveilCavern', name: 'Whisperveil Cavern', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 9 }, capacity: 32, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.03, y: 0.55 }, maxParty: 2, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 180, qiStone: 15 }, requiredReputation: 15, claimDurationMs: 30_000, bonus: { productionMultByResource: { qiStone: 1.15 } } } }),
  node({ id: 'firstRealm.glacialHollow', name: 'Glacial Hollow', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 11 }, capacity: 28, regenPerDay: 2, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.22, y: 0.68 }, maxParty: 3, onSiteDurationMs: 22_000 }),
  node({ id: 'firstRealm.starlitGrotto', name: 'Starlit Grotto', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 8 }, capacity: 35, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.09, y: 0.30 }, maxParty: 2, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 120, qiStone: 10 }, requiredReputation: 0, claimDurationMs: 25_000, bonus: { productionMultByResource: { qiStone: 1.1 } } } }),
  node({ id: 'firstRealm.duskglassCave', name: 'Duskglass Cave', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 12 }, capacity: 26, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.02, y: 0.15 }, maxParty: 3, onSiteDurationMs: 24_000, claim: { claimCost: { spiritStones: 220, qiStone: 25 }, requiredReputation: 25, claimDurationMs: 35_000, bonus: { productionMultByResource: { qiStone: 1.2 } } } }),
  node({ id: 'firstRealm.silverveilGrotto', name: 'Silverveil Grotto', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 9 }, capacity: 34, regenPerDay: 2, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.15, y: 0.92 }, maxParty: 2, onSiteDurationMs: 19_000 }),
  node({ id: 'firstRealm.cloudspringBasin', name: 'Cloudspring Basin', archetypeId: 'spiritSpring', yieldPerVisit: { qiStone: 7 }, capacity: 40, regenPerDay: 5, dangerTier: 1, travelUnits: 2, mapPosition: { x: 0.26, y: 0.50 }, maxParty: 2, onSiteDurationMs: 14_000, claim: { claimCost: { spiritStones: 100 }, requiredReputation: 0, claimDurationMs: 20_000, bonus: { productionMultByResource: { qiStone: 1.1 } } } }),
  node({ id: 'firstRealm.jadewaterSpring', name: 'Jadewater Spring', archetypeId: 'spiritSpring', yieldPerVisit: { qiStone: 8 }, capacity: 38, regenPerDay: 4, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.20, y: 0.30 }, maxParty: 2, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 140 }, requiredReputation: 5, claimDurationMs: 22_000, bonus: { productionMultByResource: { qiStone: 1.12 } } } }),
  node({ id: 'firstRealm.everflowSpring', name: 'Everflow Spring', archetypeId: 'spiritSpring', yieldPerVisit: { qiStone: 6 }, capacity: 45, regenPerDay: 6, dangerTier: 1, travelUnits: 2, mapPosition: { x: 0.07, y: 0.75 }, maxParty: 2, onSiteDurationMs: 13_000 }),
  node({ id: 'firstRealm.highmistSpring', name: 'Highmist Spring', archetypeId: 'spiritSpring', yieldPerVisit: { qiStone: 9 }, capacity: 36, regenPerDay: 3, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.12, y: 0.10 }, maxParty: 2, onSiteDurationMs: 17_000, claim: { claimCost: { spiritStones: 160 }, requiredReputation: 10, claimDurationMs: 28_000, bonus: { productionMultByResource: { qiStone: 1.15 } } } }),
  node({ id: 'firstRealm.whitecragIronMine', name: 'Whitecrag Iron Mine', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 12 }, capacity: 40, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.28, y: 0.62 }, maxParty: 3, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 150, ironEssence: 30 }, requiredReputation: 0, claimDurationMs: 30_000, bonus: { productionMultByResource: { ironEssence: 1.15 } } } }),
  node({ id: 'firstRealm.greystoneVein', name: 'Greystone Vein', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 10 }, capacity: 42, dangerTier: 1, travelUnits: 4, mapPosition: { x: 0.04, y: 0.40 }, maxParty: 3, onSiteDurationMs: 16_000, claim: { claimCost: { spiritStones: 130 }, requiredReputation: 0, claimDurationMs: 28_000, bonus: { productionMultByResource: { ironEssence: 1.1 } } } }),
  node({ id: 'firstRealm.ironfallLedge', name: 'Ironfall Ledge', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 13 }, capacity: 35, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.18, y: 0.48 }, maxParty: 3, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 180, ironEssence: 20 }, requiredReputation: 15, claimDurationMs: 32_000, bonus: { productionMultByResource: { ironEssence: 1.18 } } } }),
  node({ id: 'firstRealm.deepveinHollow', name: 'Deepvein Hollow', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 11 }, capacity: 38, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.26, y: 0.28 }, maxParty: 3, onSiteDurationMs: 17_000 }),
  node({ id: 'firstRealm.cragjadeQuarry', name: 'Cragjade Quarry', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 16 }, capacity: 36, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.10, y: 0.65 }, maxParty: 3, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 150, ironEssence: 20 }, requiredReputation: 10, claimDurationMs: 30_000, bonus: { productionMultByResource: { spiritStones: 1.15 } } } }),
  node({ id: 'firstRealm.highpeakQuarry', name: 'Highpeak Quarry', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 14 }, capacity: 40, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.22, y: 0.08 }, maxParty: 3, onSiteDurationMs: 16_000, claim: { claimCost: { spiritStones: 120 }, requiredReputation: 0, claimDurationMs: 25_000, bonus: { productionMultByResource: { spiritStones: 1.1 } } } }),

  // ==================================================================
  // Ancient Forest — 14 nodes (rare herbs, beast threats: Spirit Herb + Spirit Wood)
  // ==================================================================
  node({ id: 'firstRealm.ninePetalHerbValley', name: 'Nine-Petal Herb Valley', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 14 }, capacity: 50, regenPerDay: 5, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.48, y: 0.60 }, maxParty: 3, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 120, spiritWood: 40 }, requiredReputation: 10, claimDurationMs: 30_000, bonus: { productionMultByResource: { spiritHerb: 1.2 } } } }),
  node({ id: 'firstRealm.silkleafMeadow', name: 'Silkleaf Meadow', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 12 }, capacity: 48, regenPerDay: 4, dangerTier: 1, travelUnits: 2, mapPosition: { x: 0.32, y: 0.60 }, maxParty: 3, onSiteDurationMs: 14_000, claim: { claimCost: { spiritStones: 90, spiritWood: 20 }, requiredReputation: 0, claimDurationMs: 25_000, bonus: { productionMultByResource: { spiritHerb: 1.12 } } } }),
  node({ id: 'firstRealm.moonpetalVale', name: 'Moonpetal Vale', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 13 }, capacity: 45, regenPerDay: 4, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.38, y: 0.75 }, maxParty: 3, onSiteDurationMs: 16_000, claim: { claimCost: { spiritStones: 130 }, requiredReputation: 10, claimDurationMs: 28_000, bonus: { productionMultByResource: { spiritHerb: 1.15 } } } }),
  node({ id: 'firstRealm.sweetrootHollow', name: 'Sweetroot Hollow', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 11 }, capacity: 50, regenPerDay: 5, dangerTier: 1, travelUnits: 2, mapPosition: { x: 0.44, y: 0.80 }, maxParty: 2, onSiteDurationMs: 13_000 }),
  node({ id: 'firstRealm.cloudbellMeadow', name: 'Cloudbell Meadow', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 15 }, capacity: 40, regenPerDay: 3, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.30, y: 0.40 }, maxParty: 3, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 150, spiritWood: 30 }, requiredReputation: 15, claimDurationMs: 30_000, bonus: { productionMultByResource: { spiritHerb: 1.18 } } } }),
  node({ id: 'firstRealm.duskflowerGlen', name: 'Duskflower Glen', archetypeId: 'spiritHerbValley', yieldPerVisit: { spiritHerb: 12 }, capacity: 46, regenPerDay: 4, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.36, y: 0.20 }, maxParty: 2, onSiteDurationMs: 15_000 }),
  node({ id: 'firstRealm.elderwoodGrove', name: 'Elderwood Grove', archetypeId: 'ancientForest', yieldPerVisit: { spiritWood: 16 }, capacity: 45, dangerTier: 1, travelUnits: 4, mapPosition: { x: 0.52, y: 0.62 }, maxParty: 3, onSiteDurationMs: 16_000 }),
  node({ id: 'firstRealm.timberdeepWood', name: 'Timberdeep Wood', archetypeId: 'ancientForest', yieldPerVisit: { spiritWood: 14 }, capacity: 48, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.46, y: 0.45 }, maxParty: 3, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 100 }, requiredReputation: 0, claimDurationMs: 25_000, bonus: { productionMultByResource: { spiritWood: 1.12 } } } }),
  node({ id: 'firstRealm.oldGrowthHollow', name: 'Old Growth Hollow', archetypeId: 'ancientForest', yieldPerVisit: { spiritWood: 15 }, capacity: 42, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.40, y: 0.30 }, maxParty: 3, onSiteDurationMs: 17_000, claim: { claimCost: { spiritStones: 140 }, requiredReputation: 10, claimDurationMs: 28_000, bonus: { productionMultByResource: { spiritWood: 1.15 } } } }),
  node({ id: 'firstRealm.greatboughStand', name: 'Greatbough Stand', archetypeId: 'ancientForest', yieldPerVisit: { spiritWood: 13 }, capacity: 50, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.50, y: 0.20 }, maxParty: 3, onSiteDurationMs: 14_000, claim: { claimCost: { spiritStones: 110 }, requiredReputation: 0, claimDurationMs: 24_000, bonus: { productionMultByResource: { spiritWood: 1.1 } } } }),
  node({ id: 'firstRealm.verdantCanopy', name: 'Verdant Canopy', archetypeId: 'ancientForest', yieldPerVisit: { spiritWood: 17 }, capacity: 38, dangerTier: 2, travelUnits: 6, mapPosition: { x: 0.34, y: 0.10 }, maxParty: 3, onSiteDurationMs: 19_000, claim: { claimCost: { spiritStones: 160 }, requiredReputation: 15, claimDurationMs: 32_000, bonus: { productionMultByResource: { spiritWood: 1.2 } } } }),
  node({ id: 'firstRealm.ashmaneHuntingGrounds', name: 'Ashmane Hunting Grounds', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 10, spiritStones: 8 }, capacity: 40, regenPerDay: 4, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.44, y: 0.90 }, maxParty: 4, onSiteDurationMs: 20_000, claim: { claimCost: { spiritStones: 250 }, requiredReputation: 20, claimDurationMs: 40_000, bonus: { productionMultByResource: { spiritStones: 1.15 } } } }),
  node({ id: 'firstRealm.stagfallRange', name: 'Stagfall Range', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 9, spiritStones: 7 }, capacity: 38, regenPerDay: 3, dangerTier: 3, travelUnits: 5, mapPosition: { x: 0.28, y: 0.85 }, maxParty: 4, onSiteDurationMs: 19_000, claim: { claimCost: { spiritStones: 200 }, requiredReputation: 15, claimDurationMs: 35_000, bonus: { productionMultByResource: { spiritStones: 1.12 } } } }),
  node({ id: 'firstRealm.thornbackThicket', name: 'Thornback Thicket', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 8, spiritStones: 9 }, capacity: 36, regenPerDay: 3, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.30, y: 0.65 }, maxParty: 3, onSiteDurationMs: 17_000 }),

  // ==================================================================
  // Desert — 12 nodes (minerals, dangerous travel: Iron Essence + Spirit Stones)
  // ==================================================================
  node({ id: 'firstRealm.sunscarMine', name: 'Sunscar Mine', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 11 }, capacity: 40, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.58, y: 0.50 }, maxParty: 3, onSiteDurationMs: 17_000, claim: { claimCost: { spiritStones: 140 }, requiredReputation: 5, claimDurationMs: 28_000, bonus: { productionMultByResource: { ironEssence: 1.12 } } } }),
  node({ id: 'firstRealm.blackglassVein', name: 'Blackglass Vein', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 13 }, capacity: 36, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.74, y: 0.72 }, maxParty: 3, onSiteDurationMs: 19_000, claim: { claimCost: { spiritStones: 180, ironEssence: 20 }, requiredReputation: 20, claimDurationMs: 32_000, bonus: { productionMultByResource: { ironEssence: 1.18 } } } }),
  node({ id: 'firstRealm.emberdustShaft', name: 'Emberdust Shaft', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 12 }, capacity: 38, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.62, y: 0.78 }, maxParty: 3, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 160 }, requiredReputation: 10, claimDurationMs: 30_000, bonus: { productionMultByResource: { ironEssence: 1.15 } } } }),
  node({ id: 'firstRealm.crackedRidgeMine', name: 'Cracked Ridge Mine', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 10 }, capacity: 42, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.56, y: 0.28 }, maxParty: 3, onSiteDurationMs: 16_000 }),
  node({ id: 'firstRealm.bakedclayDeposit', name: 'Bakedclay Deposit', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 9 }, capacity: 44, dangerTier: 1, travelUnits: 3, mapPosition: { x: 0.68, y: 0.92 }, maxParty: 3, onSiteDurationMs: 15_000, claim: { claimCost: { spiritStones: 110 }, requiredReputation: 0, claimDurationMs: 24_000, bonus: { productionMultByResource: { ironEssence: 1.1 } } } }),
  node({ id: 'firstRealm.cinderjadeQuarry', name: 'Cinderjade Quarry', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 18 }, capacity: 35, dangerTier: 2, travelUnits: 5, mapPosition: { x: 0.74, y: 0.55 }, maxParty: 3, onSiteDurationMs: 18_000, claim: { claimCost: { spiritStones: 150, ironEssence: 30 }, requiredReputation: 0, claimDurationMs: 30_000, bonus: { productionMultByResource: { spiritStones: 1.15 } } } }),
  node({ id: 'firstRealm.sandglassQuarry', name: 'Sandglass Quarry', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 15 }, capacity: 40, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.60, y: 0.65 }, maxParty: 3, onSiteDurationMs: 17_000, claim: { claimCost: { spiritStones: 120 }, requiredReputation: 5, claimDurationMs: 26_000, bonus: { productionMultByResource: { spiritStones: 1.12 } } } }),
  node({ id: 'firstRealm.dunglowPit', name: 'Duneglow Pit', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 16 }, capacity: 38, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.68, y: 0.40 }, maxParty: 3, onSiteDurationMs: 19_000, claim: { claimCost: { spiritStones: 170 }, requiredReputation: 15, claimDurationMs: 32_000, bonus: { productionMultByResource: { spiritStones: 1.16 } } } }),
  node({ id: 'firstRealm.scorchedQuarry', name: 'Scorched Quarry', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 13 }, capacity: 42, dangerTier: 2, travelUnits: 4, mapPosition: { x: 0.54, y: 0.55 }, maxParty: 3, onSiteDurationMs: 16_000 }),
  node({ id: 'firstRealm.ashmaneWastes', name: 'Ashmane Wastes', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 9, spiritStones: 9 }, capacity: 36, regenPerDay: 3, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.76, y: 0.88 }, maxParty: 4, onSiteDurationMs: 22_000, claim: { claimCost: { spiritStones: 260 }, requiredReputation: 25, claimDurationMs: 42_000, bonus: { productionMultByResource: { spiritStones: 1.18 } } } }),
  node({ id: 'firstRealm.sandwormFlats', name: 'Sandworm Flats', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 8, spiritStones: 8 }, capacity: 34, regenPerDay: 3, dangerTier: 3, travelUnits: 6, mapPosition: { x: 0.70, y: 0.28 }, maxParty: 4, onSiteDurationMs: 20_000, claim: { claimCost: { spiritStones: 220 }, requiredReputation: 15, claimDurationMs: 36_000, bonus: { productionMultByResource: { ironEssence: 1.15 } } } }),
  node({ id: 'firstRealm.scorpionHollow', name: 'Scorpion Hollow', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 7, spiritStones: 10 }, capacity: 32, regenPerDay: 2, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.64, y: 0.12 }, maxParty: 4, onSiteDurationMs: 21_000 }),

  // ==================================================================
  // Forgotten Ruins — 10 nodes (rare/dangerous, high-risk high-reward)
  // ==================================================================
  node({ id: 'firstRealm.ashenVault', name: 'Ashen Vault', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 20 }, capacity: 30, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.84, y: 0.65 }, maxParty: 3, onSiteDurationMs: 22_000, claim: { claimCost: { spiritStones: 220 }, requiredReputation: 25, claimDurationMs: 38_000, bonus: { productionMultByResource: { spiritStones: 1.2 } } } }),
  node({ id: 'firstRealm.wraithjadeDeposit', name: 'Wraithjade Deposit', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 18 }, capacity: 32, dangerTier: 4, travelUnits: 6, mapPosition: { x: 0.92, y: 0.75 }, maxParty: 3, onSiteDurationMs: 21_000, claim: { claimCost: { spiritStones: 200 }, requiredReputation: 20, claimDurationMs: 36_000, bonus: { productionMultByResource: { spiritStones: 1.18 } } } }),
  node({ id: 'firstRealm.sunkenTreasury', name: 'Sunken Treasury', archetypeId: 'jadeQuarry', yieldPerVisit: { spiritStones: 22 }, capacity: 28, dangerTier: 5, travelUnits: 8, mapPosition: { x: 0.96, y: 0.50 }, maxParty: 2, onSiteDurationMs: 25_000 }),
  node({ id: 'firstRealm.hollowedSanctum', name: 'Hollowed Sanctum', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 14 }, capacity: 28, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.80, y: 0.45 }, maxParty: 2, onSiteDurationMs: 22_000, claim: { claimCost: { spiritStones: 240, qiStone: 30 }, requiredReputation: 30, claimDurationMs: 40_000, bonus: { productionMultByResource: { qiStone: 1.25 } } } }),
  node({ id: 'firstRealm.wailingCavern', name: 'Wailing Cavern', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 12 }, capacity: 30, dangerTier: 4, travelUnits: 6, mapPosition: { x: 0.90, y: 0.30 }, maxParty: 2, onSiteDurationMs: 20_000, claim: { claimCost: { spiritStones: 200 }, requiredReputation: 20, claimDurationMs: 35_000, bonus: { productionMultByResource: { qiStone: 1.18 } } } }),
  node({ id: 'firstRealm.graveHollow', name: 'Grave Hollow', archetypeId: 'spiritCrystalCave', yieldPerVisit: { qiStone: 13 }, capacity: 26, dangerTier: 5, travelUnits: 8, mapPosition: { x: 0.84, y: 0.15 }, maxParty: 2, onSiteDurationMs: 24_000 }),
  node({ id: 'firstRealm.bonewasteRange', name: 'Bonewaste Range', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 12, spiritStones: 10 }, capacity: 30, regenPerDay: 2, dangerTier: 5, travelUnits: 8, mapPosition: { x: 0.96, y: 0.85 }, maxParty: 4, onSiteDurationMs: 24_000, claim: { claimCost: { spiritStones: 280 }, requiredReputation: 30, claimDurationMs: 42_000, bonus: { productionMultByResource: { spiritStones: 1.2 } } } }),
  node({ id: 'firstRealm.grimwatchThicket', name: 'Grimwatch Thicket', archetypeId: 'beastHuntingGrounds', yieldPerVisit: { ironEssence: 11, spiritStones: 9 }, capacity: 28, regenPerDay: 2, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.78, y: 0.60 }, maxParty: 4, onSiteDurationMs: 22_000 }),
  node({ id: 'firstRealm.duskmetalShaft', name: 'Duskmetal Shaft', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 14 }, capacity: 26, dangerTier: 4, travelUnits: 7, mapPosition: { x: 0.94, y: 0.55 }, maxParty: 3, onSiteDurationMs: 21_000, claim: { claimCost: { spiritStones: 220 }, requiredReputation: 20, claimDurationMs: 36_000, bonus: { productionMultByResource: { ironEssence: 1.2 } } } }),
  node({ id: 'firstRealm.ruinboundVein', name: 'Ruinbound Vein', archetypeId: 'spiritIronMine', yieldPerVisit: { ironEssence: 13 }, capacity: 28, dangerTier: 4, travelUnits: 6, mapPosition: { x: 0.86, y: 0.35 }, maxParty: 3, onSiteDurationMs: 20_000 }),
]

export function getLandmarkDef(id: LocationId): LocationDefinition | undefined {
  return LANDMARK_DEFS.find((l) => l.id === id)
}

export function getLandmarksForProvince(provinceId: ProvinceId): LocationDefinition[] {
  return LANDMARK_DEFS.filter((l) => l.provinceId === provinceId)
}
