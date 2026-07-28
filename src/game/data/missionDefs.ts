import type { MissionType, Resources } from '../types'

export interface MissionDefinition {
  id: string
  type: MissionType
  name: string
  description: string
  risk: 'Low' | 'Moderate' | 'High'
  durationMs: number
  squadSizeMin: number
  squadSizeMax: number
  /** Hunting missions resolve through Combat Power (doc 06 §5) instead of the generic success-chance roll. */
  isCombat: boolean
  /** 0-1, non-combat missions only. */
  baseSuccessChance: number
  /** Combat missions only — the fixed opposing Combat Power for this encounter. */
  enemyCombatPower?: number
  rewardTable: Partial<Resources>
}

/**
 * MVP mission pool (doc 04 §13: Gathering/Hunting/Escort only). Durations
 * and rewards are dev-placeholder scale (tens of seconds, tens of
 * resources) so a live tester sees a mission resolve quickly, same
 * convention as every other wave's numeric tuning — real balancing is
 * Wave 8's job.
 *
 * Hunting rewards are Raw Materials + Spirit Stones rather than the doc's
 * "Beast Core" (doc 01 §13 / roadmap Wave 9) since that material doesn't
 * exist yet. Escort rewards are Spirit Stones only — doc 04 §2 also lists
 * Reputation, but Reputation/Factions don't exist until Wave 7.
 *
 * Wave 8 internal-consistency pass: the harder mission in each risk pair
 * (Prospect Iron Vein, Hunt: Ravine Wolf Pack, Escort Visiting Dignitary)
 * paid strictly less reward per disciple-second tied up than its easier
 * counterpart despite needing a bigger/riskier squad — a dominated choice
 * with no real decision behind it. Rewards were raised to close that gap;
 * scale/tuning stays dev-placeholder per PROJECT.md §7.
 */
export const MISSION_DEFS: MissionDefinition[] = [
  {
    id: 'gatherSpiritHerbs',
    type: 'Gathering',
    name: 'Gather Spirit Herbs',
    description: "Sweep the sect's outer valleys for wild Spirit Herb. Low risk, steady reward.",
    risk: 'Low',
    durationMs: 20_000,
    squadSizeMin: 1,
    squadSizeMax: 2,
    isCombat: false,
    baseSuccessChance: 0.9,
    rewardTable: { spiritHerb: 25, spiritStones: 10 },
  },
  {
    id: 'prospectIronVein',
    type: 'Gathering',
    name: 'Prospect Iron Vein',
    description: 'Chart an unclaimed iron vein deeper in the mountains — a bit more exposure than herb gathering.',
    risk: 'Low',
    durationMs: 25_000,
    squadSizeMin: 1,
    squadSizeMax: 2,
    isCombat: false,
    baseSuccessChance: 0.85,
    rewardTable: { ironEssence: 30, spiritWood: 15 },
  },
  {
    id: 'huntMountainBeast',
    type: 'Hunting',
    name: 'Hunt: Mountain Beast',
    description: 'Track and fell a spirit beast prowling the foothills. Combat-resolved — favors combat-focused disciples.',
    risk: 'Moderate',
    durationMs: 30_000,
    squadSizeMin: 1,
    squadSizeMax: 3,
    isCombat: true,
    baseSuccessChance: 0,
    enemyCombatPower: 45,
    rewardTable: { spiritStones: 30, ironEssence: 15 },
  },
  {
    id: 'huntRavineWolves',
    type: 'Hunting',
    name: 'Hunt: Ravine Wolf Pack',
    description: 'A wolf pack has been raiding outer patrols. Combat-resolved, tougher than a lone beast.',
    risk: 'High',
    durationMs: 40_000,
    squadSizeMin: 2,
    squadSizeMax: 3,
    isCombat: true,
    baseSuccessChance: 0,
    enemyCombatPower: 85,
    rewardTable: { spiritStones: 70, ironEssence: 30, spiritHerb: 20 },
  },
  {
    id: 'escortMerchantCaravan',
    type: 'Escort',
    name: 'Escort Merchant Caravan',
    description: 'Guard a merchant caravan on the road to the next town.',
    risk: 'Moderate',
    durationMs: 30_000,
    squadSizeMin: 1,
    squadSizeMax: 2,
    isCombat: false,
    baseSuccessChance: 0.75,
    rewardTable: { spiritStones: 60 },
  },
  {
    id: 'escortDignitary',
    type: 'Escort',
    name: 'Escort Visiting Dignitary',
    description: 'A dignitary from a nearby sect requests safe passage. Higher stakes, higher pay.',
    risk: 'High',
    durationMs: 40_000,
    squadSizeMin: 2,
    squadSizeMax: 3,
    isCombat: false,
    baseSuccessChance: 0.65,
    rewardTable: { spiritStones: 160 },
  },
]

export function getMissionDef(id: string): MissionDefinition {
  const def = MISSION_DEFS.find((m) => m.id === id)
  if (!def) throw new Error(`Unknown mission id: ${id}`)
  return def
}
