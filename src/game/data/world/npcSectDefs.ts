import type { NpcSectTier, RegionId, Resources, SectSiteId } from '../../types'

/**
 * The static NPC sect roster (FIRST_REALM_PLAN §2.3 / §3 / §4.4). One entry per
 * seat born at world-gen: every Normal/Good (prestige) seat gets a sect, plus a
 * subset of Poor seats get a minor sect, leaving the rest free for founding and
 * for the emergence mechanic (Wave C) to eventually refill. `engine/world/
 * founding.ts` reads `getOccupiedPoorSeatIds()` to keep the founding pool to
 * genuinely free Poor seats.
 *
 * Three of `data/factionDefs.ts`'s legendary factions are promoted into named
 * NPC sects holding the most prestigious seats (§3's recommendation): Azure
 * Dawn Sect and Silver Phoenix Clan hold the two Good seats, Bloodmoon Cult
 * holds a Normal seat in the Desert (continuing its old Ember Wastes
 * `controllingFactionId` role). The remaining Kingdom/Merchant Guild factions
 * stay dormant, non-territorial flavour (diplomacy is deferred, §11).
 *
 * `strength`/`stockpile`/`aggression` are Wave A seed values only — inert until
 * Wave C's NPC simulation (and Wave B's combat) start reading/mutating them.
 */
export interface NpcSectDefinition {
  id: string
  name: string
  tier: NpcSectTier
  regionId: RegionId
  seatSiteId: SectSiteId
  strength: number
  stockpile: Partial<Resources>
  aggression: number
}

export const NPC_SECT_DEFS: NpcSectDefinition[] = [
  // --- Legendary: the two Good seats ---
  {
    id: 'azureDawnSect',
    name: 'Azure Dawn Sect',
    tier: 'legendary',
    regionId: 'spiritMountain',
    seatSiteId: 'sacredPeak',
    strength: 220,
    stockpile: { spiritStones: 800, qiStone: 250, ironEssence: 200, spiritWood: 150, spiritHerb: 150 },
    aggression: 0.5,
  },
  {
    id: 'silverPhoenixClan',
    name: 'Silver Phoenix Clan',
    tier: 'legendary',
    regionId: 'forgottenRuins',
    seatSiteId: 'obsidianThrone',
    strength: 210,
    stockpile: { spiritStones: 900, qiStone: 150, ironEssence: 250, spiritWood: 100, spiritHerb: 100 },
    aggression: 0.55,
  },

  // --- Major: the most aggressive Normal seat ---
  {
    id: 'bloodmoonCult',
    name: 'Bloodmoon Cult',
    tier: 'major',
    regionId: 'desert',
    seatSiteId: 'obsidianSpire',
    strength: 140,
    stockpile: { spiritStones: 350, ironEssence: 200, spiritHerb: 40 },
    aggression: 0.8,
  },

  // --- Regional: the remaining 9 Normal seats ---
  {
    id: 'cloudpierceOrder',
    name: 'Cloudpierce Order',
    tier: 'regional',
    regionId: 'spiritMountain',
    seatSiteId: 'cliffPlateau',
    strength: 110,
    stockpile: { spiritStones: 300, qiStone: 80, ironEssence: 60 },
    aggression: 0.45,
  },
  {
    id: 'hiddenValleyCovenant',
    name: 'Hidden Valley Covenant',
    tier: 'regional',
    regionId: 'spiritMountain',
    seatSiteId: 'hiddenValley',
    strength: 100,
    stockpile: { spiritStones: 280, qiStone: 100 },
    aggression: 0.4,
  },
  {
    id: 'thundercrestBrotherhood',
    name: 'Thundercrest Brotherhood',
    tier: 'regional',
    regionId: 'spiritMountain',
    seatSiteId: 'thundercrestRidge',
    strength: 105,
    stockpile: { spiritStones: 260, qiStone: 120 },
    aggression: 0.5,
  },
  {
    id: 'riverBasinAssembly',
    name: 'River Basin Assembly',
    tier: 'regional',
    regionId: 'ancientForest',
    seatSiteId: 'riverBasin',
    strength: 95,
    stockpile: { spiritStones: 220, spiritHerb: 150, spiritWood: 80 },
    aggression: 0.35,
  },
  {
    id: 'elderwoodCircle',
    name: 'Elderwood Circle',
    tier: 'regional',
    regionId: 'ancientForest',
    seatSiteId: 'elderwoodSanctum',
    strength: 100,
    stockpile: { spiritStones: 200, spiritWood: 200 },
    aggression: 0.4,
  },
  {
    id: 'mistfenLodge',
    name: 'Mistfen Lodge',
    tier: 'regional',
    regionId: 'ancientForest',
    seatSiteId: 'mistfenHollow',
    strength: 90,
    stockpile: { spiritStones: 180, spiritHerb: 90 },
    aggression: 0.3,
  },
  {
    id: 'cinderforgeCompany',
    name: 'Cinderforge Company',
    tier: 'regional',
    regionId: 'desert',
    seatSiteId: 'cinderTerrace',
    strength: 115,
    stockpile: { spiritStones: 250, ironEssence: 220 },
    aggression: 0.55,
  },
  {
    id: 'wraithbindCoven',
    name: 'Wraithbind Coven',
    tier: 'regional',
    regionId: 'forgottenRuins',
    seatSiteId: 'wraithbindHollow',
    strength: 120,
    stockpile: { spiritStones: 300, qiStone: 90 },
    aggression: 0.6,
  },
  {
    id: 'necropolisWatch',
    name: 'Necropolis Watch',
    tier: 'regional',
    regionId: 'forgottenRuins',
    seatSiteId: 'silentNecropolis',
    strength: 125,
    stockpile: { spiritStones: 320, ironEssence: 150 },
    aggression: 0.6,
  },

  // --- Minor: 12 of the 20 Poor seats (8 stay free for founding + growth) ---
  { id: 'foothillBand', name: 'Foothill Band', tier: 'minor', regionId: 'spiritMountain', seatSiteId: 'foothillHollow', strength: 25, stockpile: { spiritStones: 60 }, aggression: 0.25 },
  { id: 'stonebrookHermitage', name: 'Stonebrook Hermitage', tier: 'minor', regionId: 'spiritMountain', seatSiteId: 'stonebrookTerrace', strength: 20, stockpile: { spiritStones: 50 }, aggression: 0.2 },
  { id: 'windwardWanderers', name: 'Windward Wanderers', tier: 'minor', regionId: 'spiritMountain', seatSiteId: 'windwardLedge', strength: 22, stockpile: { spiritStones: 55, qiStone: 20 }, aggression: 0.25 },
  { id: 'cragsideKin', name: 'Cragside Kin', tier: 'minor', regionId: 'spiritMountain', seatSiteId: 'cragsideHamlet', strength: 18, stockpile: { spiritStones: 45 }, aggression: 0.2 },
  { id: 'mossbankHermits', name: 'Mossbank Hermits', tier: 'minor', regionId: 'ancientForest', seatSiteId: 'mossbankClearing', strength: 20, stockpile: { spiritHerb: 40 }, aggression: 0.2 },
  { id: 'fernwatchRangers', name: 'Fernwatch Rangers', tier: 'minor', regionId: 'ancientForest', seatSiteId: 'fernwatchCamp', strength: 24, stockpile: { spiritHerb: 50, spiritWood: 20 }, aggression: 0.3 },
  { id: 'willowbrookCircle', name: 'Willowbrook Circle', tier: 'minor', regionId: 'ancientForest', seatSiteId: 'willowbrookGlade', strength: 22, stockpile: { spiritHerb: 45 }, aggression: 0.25 },
  { id: 'sunbleachedCaravan', name: 'Sunbleached Caravan', tier: 'minor', regionId: 'desert', seatSiteId: 'sunbleachedCamp', strength: 22, stockpile: { spiritStones: 60 }, aggression: 0.3 },
  { id: 'dunesEdgeTraders', name: "Dune's Edge Traders", tier: 'minor', regionId: 'desert', seatSiteId: 'dunesEdgeOutpost', strength: 26, stockpile: { spiritStones: 70, ironEssence: 20 }, aggression: 0.3 },
  { id: 'crackedBasinNomads', name: 'Cracked Basin Nomads', tier: 'minor', regionId: 'desert', seatSiteId: 'crackedBasin', strength: 20, stockpile: { spiritStones: 50 }, aggression: 0.25 },
  { id: 'bonepaleScavengers', name: 'Bonepale Scavengers', tier: 'minor', regionId: 'forgottenRuins', seatSiteId: 'bonepaleCrossing', strength: 30, stockpile: { spiritStones: 80 }, aggression: 0.35 },
  { id: 'shatteredArchwayCult', name: 'Shattered Archway Cult', tier: 'minor', regionId: 'forgottenRuins', seatSiteId: 'shatteredArchway', strength: 32, stockpile: { spiritStones: 90, qiStone: 15 }, aggression: 0.35 },
]

export function getNpcSectDef(id: string): NpcSectDefinition {
  const def = NPC_SECT_DEFS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown NPC sect id: ${id}`)
  return def
}

/** The NPC sect (if any) seeded onto a given seat at world-gen. */
export function getNpcSectDefForSeat(seatSiteId: SectSiteId): NpcSectDefinition | undefined {
  return NPC_SECT_DEFS.find((s) => s.seatSiteId === seatSiteId)
}

/** Every Poor seat with a seeded NPC sect — the founding pool excludes these (engine/world/founding.ts). */
export function getOccupiedPoorSeatIds(): SectSiteId[] {
  return NPC_SECT_DEFS.filter((s) => s.tier === 'minor').map((s) => s.seatSiteId)
}
