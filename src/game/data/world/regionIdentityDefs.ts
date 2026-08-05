import type { RegionId } from '../../types'

/**
 * Region identity (FIRST_REALM_PLAN §8 Wave D). The four regions read the same
 * from the map, but their inhabitants behave differently: the frontier ruins are
 * lawless and expansionist, the forest reclusive, the desert harsh on the weak.
 * `npcSimulation` folds these biases into each sect's pulse, so where a sect
 * sits colours how readily it climbs/raids, how fast it grows, and how hard
 * decline bites — giving the map regional character without any new mechanic.
 */
export interface RegionIdentity {
  /** Human-readable flavour of the region's temperament. */
  temperament: string
  /** Added to a sect's aggression when weighting aggressive actions (climb/raid) over claiming. */
  aggressionBias: number
  /** Multiplies active-status strength/stockpile growth. */
  growthMult: number
  /** Multiplies the strength a *declining* prestige-seat sect sheds per pulse (harsh regions cull faster). */
  attritionMult: number
}

export const REGION_IDENTITY: Record<RegionId, RegionIdentity> = {
  spiritMountain: { temperament: 'contested heartland', aggressionBias: 0.05, growthMult: 1.0, attritionMult: 1.0 },
  ancientForest: { temperament: 'reclusive groves', aggressionBias: -0.1, growthMult: 0.9, attritionMult: 0.8 },
  desert: { temperament: 'harsh wastes', aggressionBias: 0.1, growthMult: 0.95, attritionMult: 1.3 },
  forgottenRuins: { temperament: 'lawless ruins', aggressionBias: 0.2, growthMult: 1.15, attritionMult: 1.1 },
}
