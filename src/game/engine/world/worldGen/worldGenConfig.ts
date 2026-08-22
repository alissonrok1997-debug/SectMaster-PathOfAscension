import type {
  NpcSectTier,
  RegionId,
  Resources,
  SectSiteTier,
} from '../../../types'
import type { NumberRange } from '../../rng'

/**
 * The tuning surface for the procedural generator (WORLD_PROCGEN_PLAN Wave 2). Everything the
 * old authored rows encoded as instances now lives here as rules/budgets: how many territories
 * and of which tiers, where the four region belts sit, the flavour lexicons (the *entire* flavour
 * budget per the locked config), and — for Wave 2 — fixed representative modifier/NPC values per
 * tier (Wave 4 replaces those with rolled archetypes). Counts/tiers/economy are fixed; only
 * geometry, regions and names vary per seed this wave.
 */

/** A region quadrant: the corner rect its seats are sampled in and how many territories it holds. */
export interface RegionCore {
  id: RegionId
  /** The region's sampling rect — a corner quadrant of the board (normalised). */
  bounds: { x0: number; x1: number; y0: number; y1: number }
  size: number
}

/** Per-region name parts. Territory names are `prefix + root`, the root drawn from the tier register. */
export interface Lexicon {
  prefixes: string[]
  roots: Record<SectSiteTier, string[]>
}

/**
 * Rolled site archetype for a tier (WORLD_PROCGEN_PLAN Wave 4). Each field is a range the generator
 * rolls within, so no two seats of a tier are identical. `productionMult` is applied to the region's
 * production resource (the biome nudge). Good seats trade building slots for power — "a bigger prize
 * pays a structural price" (like Sacred Peak's −4 slots / ×1.4 cultivation).
 */
export interface SiteArchetype {
  buildingSlots: NumberRange
  cultivationSpeedMult: NumberRange
  defenceMult: NumberRange
  /** Applied to the region's production resource; a roll ≤ ~1 is treated as no boost. */
  productionMult: NumberRange
  /** Probability [0,1] each optional secondary mult (recruit/upkeep/build) is applied. */
  secondaryChance: number
  recruitmentRateMult?: NumberRange
  upkeepMult?: NumberRange
  buildTimeMult?: NumberRange
  /** A starting grant of the region's resource, applied with `chance`. */
  startingBonus?: { chance: number; range: NumberRange }
}

/** Rolled NPC archetype for an owner tier (Wave 4): stat ranges rolled per sect. */
export interface NpcArchetype {
  strength: NumberRange
  aggression: NumberRange
  stockpile: Partial<Record<keyof Resources, NumberRange>>
}

/** A weighted template choice for a biome's resource nodes (Wave 3). */
export interface NodeArchetypeWeight {
  templateId: string
  weight: number
}

export interface WorldGenConfig {
  territoryCount: number
  tierBudget: Record<SectSiteTier, number>
  regions: RegionCore[]
  /** The realm's centre: no region seat is sampled inside this disc (normalised). */
  hub: { cx: number; cy: number; r: number }
  veinTier: number
  npcTierBudget: Record<NpcSectTier, number>
  foundingFreePoorMin: number
  tierArchetypes: Record<SectSiteTier, SiteArchetype>
  npcArchetypes: Record<NpcSectTier, NpcArchetype>
  /** The resource each region's seats boost and grant (the biome nudge, Wave 4). */
  regionProductionResource: Record<RegionId, keyof Resources>
  nameLexicons: Record<RegionId, Lexicon>
  sectNameLexicon: { adjectives: string[]; nouns: string[]; suffixes: string[] }
  // --- Resource nodes (Wave 3) ---
  nodeCountPerTerritory: NumberRange
  /** The signature template every territory in a region is guaranteed at least one of (invariant #4). */
  regionSignatureTemplate: Record<RegionId, string>
  /** The weighted template pool a region's remaining nodes are drawn from. */
  biomeNodeWeights: Record<RegionId, NodeArchetypeWeight[]>
  /** Danger offset per region temperament, added on top of the radial (distance-from-centre) base. */
  regionDangerOffset: Record<RegionId, number>
  /** Fraction of a territory's nodes that roll a claimable outpost `upgradePath`. */
  claimableNodeFraction: number
}

export const WORLD_GEN_CONFIG: WorldGenConfig = {
  territoryCount: 64,
  tierBudget: { good: 4, normal: 20, poor: 40 },
  // Four corner quadrants (ring order NW→NE→SE→SW, each running from its corner in toward the
  // centre) plus the central hub, The Heavenly Axis, sampled inside the hub disc. The 0.47–0.53
  // gutter at the midlines keeps the borders legible. 15×4 rim + 4 axis = 64.
  regions: [
    { id: 'spiritMountain', bounds: { x0: 0.03, x1: 0.47, y0: 0.05, y1: 0.47 }, size: 15 },
    { id: 'ancientForest', bounds: { x0: 0.53, x1: 0.97, y0: 0.05, y1: 0.47 }, size: 15 },
    { id: 'desert', bounds: { x0: 0.53, x1: 0.97, y0: 0.53, y1: 0.95 }, size: 15 },
    { id: 'forgottenRuins', bounds: { x0: 0.03, x1: 0.47, y0: 0.53, y1: 0.95 }, size: 15 },
    // The Heavenly Axis: sampled inside the hub disc (bounds = its bbox); the generator gates on the disc.
    { id: 'heavenlyAxis', bounds: { x0: 0.3, x1: 0.7, y0: 0.3, y1: 0.7 }, size: 4 },
  ],
  hub: { cx: 0.5, cy: 0.5, r: 0.2 },
  veinTier: 2,
  // Sums to 24 occupied seats: 4 Good→legendary, 20 Normal→2 major + 18 regional. Poor seats are
  // never seeded (MULTIPLAYER_PLAN §0.4), so all 40 stay free for players; `minor` is kept at 0
  // rather than removed because NpcSectTier still carries it for legacy saves.
  npcTierBudget: { legendary: 4, major: 2, regional: 18, minor: 0 },
  foundingFreePoorMin: 12,
  // Biome nudge: each region's seats boost and grant its signature resource.
  regionProductionResource: { spiritMountain: 'qiStone', ancientForest: 'spiritHerb', desert: 'ironEssence', forgottenRuins: 'spiritStones', heavenlyAxis: 'qiStone' },
  tierArchetypes: {
    poor: {
      buildingSlots: { min: 12, max: 12 },
      cultivationSpeedMult: { min: 1.0, max: 1.05 },
      defenceMult: { min: 0.85, max: 0.92 },
      productionMult: { min: 1.0, max: 1.0 },
      secondaryChance: 0.35,
      recruitmentRateMult: { min: 1.05, max: 1.12 },
      upkeepMult: { min: 0.9, max: 0.96 },
    },
    normal: {
      buildingSlots: { min: 11, max: 12 },
      cultivationSpeedMult: { min: 1.08, max: 1.18 },
      defenceMult: { min: 0.9, max: 1.28 },
      productionMult: { min: 1.1, max: 1.28 },
      secondaryChance: 0.5,
      recruitmentRateMult: { min: 1.08, max: 1.16 },
      upkeepMult: { min: 0.88, max: 0.95 },
      buildTimeMult: { min: 0.85, max: 0.95 },
      startingBonus: { chance: 0.4, range: { min: 30, max: 50 } },
    },
    // A bigger prize pays a structural price: fewer building slots, more power.
    good: {
      buildingSlots: { min: 8, max: 9 },
      cultivationSpeedMult: { min: 1.3, max: 1.42 },
      defenceMult: { min: 1.15, max: 1.32 },
      productionMult: { min: 1.25, max: 1.35 },
      secondaryChance: 0.6,
      recruitmentRateMult: { min: 1.1, max: 1.2 },
      upkeepMult: { min: 0.85, max: 0.95 },
      buildTimeMult: { min: 0.85, max: 0.95 },
      startingBonus: { chance: 1.0, range: { min: 40, max: 60 } },
    },
  },
  npcArchetypes: {
    legendary: {
      strength: { min: 200, max: 225 },
      aggression: { min: 0.48, max: 0.58 },
      stockpile: { spiritStones: { min: 750, max: 950 }, qiStone: { min: 150, max: 260 }, ironEssence: { min: 180, max: 260 }, spiritWood: { min: 100, max: 160 }, spiritHerb: { min: 100, max: 160 } },
    },
    major: {
      strength: { min: 130, max: 155 },
      aggression: { min: 0.72, max: 0.85 },
      stockpile: { spiritStones: { min: 300, max: 400 }, ironEssence: { min: 150, max: 240 }, spiritHerb: { min: 30, max: 60 } },
    },
    regional: {
      strength: { min: 90, max: 125 },
      aggression: { min: 0.35, max: 0.6 },
      stockpile: { spiritStones: { min: 180, max: 330 }, qiStone: { min: 60, max: 130 }, ironEssence: { min: 60, max: 160 } },
    },
    minor: {
      strength: { min: 18, max: 32 },
      aggression: { min: 0.2, max: 0.35 },
      stockpile: { spiritStones: { min: 45, max: 90 } },
    },
  },
  nameLexicons: {
    spiritMountain: {
      prefixes: ['Frost', 'Cloud', 'Storm', 'Wind', 'Crag', 'Stone', 'Thunder', 'High', 'Mist', 'Snow', 'Iron', 'Cold'],
      roots: {
        poor: ['hollow', 'ledge', 'terrace', 'brook', 'hamlet', 'fold', 'pines', 'shelf'],
        normal: ['ridge', 'plateau', 'valley', 'crest', 'pass', 'cliff'],
        good: ['Peak', 'Summit', 'Crown', 'Apex'],
      },
    },
    ancientForest: {
      prefixes: ['Moss', 'Fern', 'Willow', 'Elder', 'Thorn', 'Silk', 'Dusk', 'Green', 'Briar', 'Cedar', 'Bramble', 'Ivy'],
      roots: {
        poor: ['clearing', 'camp', 'glade', 'meadow', 'hollow', 'brook', 'grove'],
        normal: ['basin', 'sanctum', 'thicket', 'vale', 'glen', 'stand'],
        good: ['Heartwood', 'Grovemother', 'Wildreach'],
      },
    },
    desert: {
      prefixes: ['Sun', 'Ash', 'Dune', 'Cinder', 'Cracked', 'Scorch', 'Ember', 'Sand', 'Bone', 'Dust', 'Blister', 'Salt'],
      roots: {
        poor: ['camp', 'outpost', 'basin', 'flat', 'wells', 'reach', 'hollow'],
        normal: ['terrace', 'spire', 'ridge', 'quarry', 'mesa'],
        good: ['Obelisk', 'Sunthrone', 'Glasscrown'],
      },
    },
    forgottenRuins: {
      prefixes: ['Bone', 'Grey', 'Sunken', 'Wraith', 'Silent', 'Grave', 'Ashen', 'Ruin', 'Hollow', 'Pale', 'Dread', 'Broken'],
      roots: {
        poor: ['crossing', 'archway', 'causeway', 'reliquary', 'hollow', 'ford'],
        normal: ['necropolis', 'sanctum', 'vault', 'spire', 'barrow'],
        good: ['Throne', 'Mausoleum', 'Deepcrypt'],
      },
    },
    heavenlyAxis: {
      prefixes: ['Heaven', 'Azure', 'Divine', 'Empyrean', 'Radiant', 'Celestial', 'Immortal', 'Ascendant', 'Golden', 'Eternal'],
      roots: {
        poor: ['approach', 'gate', 'step', 'landing', 'threshold'],
        normal: ['ascent', 'expanse', 'firmament', 'gyre', 'reach'],
        good: ['Axis', 'Empyrean', 'Zenith', 'Firmament'],
      },
    },
  },
  sectNameLexicon: {
    adjectives: ['Azure', 'Silver', 'Crimson', 'Golden', 'Jade', 'Obsidian', 'Bloodmoon', 'Iron', 'Cloud', 'Thunder', 'Ashen', 'Verdant', 'Frost', 'Ember', 'Grey', 'Scarlet'],
    nouns: ['Dawn', 'Phoenix', 'Lotus', 'Serpent', 'Flame', 'Moon', 'Blade', 'Fang', 'Pavilion', 'Peak', 'River', 'Thorn', 'Crane', 'Tiger', 'Vein', 'Star'],
    suffixes: ['Sect', 'Clan', 'Order', 'Cult', 'Brotherhood', 'Coven', 'Pavilion', 'Assembly', 'Lodge', 'Circle'],
  },
  nodeCountPerTerritory: { min: 1, max: 3 },
  // Each region's signature resource, guaranteed once per territory → all four resource types exist every map.
  regionSignatureTemplate: {
    spiritMountain: 'spiritCrystalCave', // qiStone
    ancientForest: 'spiritHerbValley', // spiritHerb
    desert: 'spiritIronMine', // ironEssence
    forgottenRuins: 'jadeQuarry', // spiritStones
    heavenlyAxis: 'spiritCrystalCave', // qiStone — the realm's converging qi
  },
  biomeNodeWeights: {
    spiritMountain: [
      { templateId: 'spiritCrystalCave', weight: 3 },
      { templateId: 'spiritSpring', weight: 2 },
      { templateId: 'spiritIronMine', weight: 2 },
      { templateId: 'jadeQuarry', weight: 1 },
    ],
    ancientForest: [
      { templateId: 'spiritHerbValley', weight: 3 },
      { templateId: 'ancientForest', weight: 2 },
      { templateId: 'beastHuntingGrounds', weight: 1 },
      { templateId: 'spiritSpring', weight: 1 },
    ],
    desert: [
      { templateId: 'spiritIronMine', weight: 3 },
      { templateId: 'jadeQuarry', weight: 2 },
      { templateId: 'beastHuntingGrounds', weight: 1 },
    ],
    forgottenRuins: [
      { templateId: 'jadeQuarry', weight: 3 },
      { templateId: 'spiritCrystalCave', weight: 1 },
      { templateId: 'spiritIronMine', weight: 1 },
      { templateId: 'beastHuntingGrounds', weight: 2 },
    ],
    heavenlyAxis: [
      { templateId: 'spiritCrystalCave', weight: 3 },
      { templateId: 'spiritSpring', weight: 2 },
      { templateId: 'jadeQuarry', weight: 1 },
    ],
  },
  // Temperament only — the radial base (distance from the map centre) now carries the gradient.
  regionDangerOffset: { spiritMountain: 0, ancientForest: 0, desert: 1, forgottenRuins: 1, heavenlyAxis: 2 },
  claimableNodeFraction: 0.5,
}
