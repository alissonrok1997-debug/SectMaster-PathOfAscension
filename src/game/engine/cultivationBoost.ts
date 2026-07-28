import type { DiscipleInstance, GameState, Resources } from '../types'
import { RESOURCE_LABELS } from '../data/resourceLabels'

/**
 * Active Cultivation Boost (doc 01, Section 2 / doc 02, Section 2 — Training
 * Ground). A disciple assigned to the Training Ground can be boosted by
 * spending Qi Stone + Spirit Herb directly, trading the sect's passive Qi
 * Stone production for that disciple's faster growth.
 */

export const BOOST_COST: Partial<Resources> = { qiStone: 20, spiritHerb: 15 }
export const BOOST_DURATION_MS = 30_000
/** % cultivation progress per second while boosted, at talentFactor 1 — well above Training Hall's rate to justify the cost. */
export const BOOST_RATE_PER_SECOND = 2.0
export const QI_PRODUCTION_PENALTY_MULTIPLIER = 0.5

export interface BoostEligibility {
  canActivate: boolean
  reason?: string
}

export function getBoostEligibility(state: GameState, discipleId: string): BoostEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { canActivate: false, reason: 'Disciple not found.' }

  if (disciple.assignedBuildingId !== 'trainingGround') {
    return { canActivate: false, reason: 'Must be assigned to the Training Ground first.' }
  }
  if (disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > Date.now()) {
    return { canActivate: false, reason: 'Boost already active.' }
  }
  const deficits = (Object.entries(BOOST_COST) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]} (have ${Math.floor(state.resources[key])})`)

  if (deficits.length > 0) {
    return { canActivate: false, reason: `Need ${deficits.join(', ')}.` }
  }

  return { canActivate: true }
}

export function isDiscipleBoosted(disciple: DiscipleInstance, now: number): boolean {
  return disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > now
}
