import { CULTIVATION_REALMS, type DiscipleInstance, type GameState, type Resources } from '../types'
import { BOOST_RATE_PER_SECOND } from './cultivationBoost'
import { getResearchCultivationRateMultiplier } from './research'
import { getDoctrineModifiers } from './doctrine'
import { getWorldEventModifiers } from './worldEvents'

/**
 * Cultivation progress, breakthroughs, injury recovery, and Presence
 * Requirement expiry (doc 03, Sections 2-3, 8-9). Layer 1/3-style
 * continuous + periodic checks per doc 09's simulation layering, folded
 * into the same tick as everything else for this prototype's scale.
 */

export const TRAINING_HALL_RATE_PER_LEVEL = 1.0 // % cultivation progress per second, per Training Hall level, at talentFactor 1
const BACKGROUND_RATE = 0.12 // % per second for disciples not in the Training Hall — cultivation never fully stops

const INJURY_MULTIPLIER: Record<DiscipleInstance['injury'], number> = {
  none: 1,
  minor: 0.7,
  major: 0.4,
  critical: 0.1,
}

function getTalentFactor(talent: number): number {
  return 0.5 + talent / 100
}

/** Qi Stone cost for a breakthrough attempt out of the realm at `realmIndex`. */
function getBreakthroughCost(realmIndex: number): number {
  return 15 * (realmIndex + 1)
}

/** Higher Talent raises breakthrough success chance (doc 03, Section 3). */
function getSuccessChance(talent: number): number {
  return Math.min(95, Math.max(15, 50 + (talent - 50) * 0.6)) / 100
}

/** Current cultivation progress gained per second for this disciple — the same formula the tick uses, exposed for the UI's rate display. 0 if away or already at the final realm. `rateMultiplier` folds in Research/Doctrine bonuses (defaults to 1, i.e. no change). */
export function getDiscipleCultivationRate(
  disciple: DiscipleInstance,
  trainingHallLevel: number,
  rateMultiplier: number = 1,
): number {
  if (disciple.awayUntil !== undefined) return 0
  if (CULTIVATION_REALMS.indexOf(disciple.realm) === CULTIVATION_REALMS.length - 1) return 0

  const now = Date.now()
  const isBoosted = disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > now
  const isTraining = disciple.assignedBuildingId === 'trainingHall' && trainingHallLevel > 0
  const baseRate = isBoosted
    ? BOOST_RATE_PER_SECOND
    : isTraining
      ? TRAINING_HALL_RATE_PER_LEVEL * trainingHallLevel
      : BACKGROUND_RATE

  return baseRate * getTalentFactor(disciple.talent) * INJURY_MULTIPLIER[disciple.injury] * rateMultiplier
}

export interface CultivationTickResult {
  disciples: DiscipleInstance[]
  resources: Resources
}

export function applyCultivationTick(state: GameState, deltaMs: number): CultivationTickResult {
  const now = Date.now()
  const deltaSeconds = deltaMs / 1000
  const trainingHallLevel = state.buildings.trainingHall?.level ?? 0
  const rateMultiplier =
    getResearchCultivationRateMultiplier(state) *
    getDoctrineModifiers(state).cultivationRateMult *
    getWorldEventModifiers(state).cultivationRateMult

  let resources = state.resources
  let anyChanged = false

  const disciples = state.disciples.map((disciple) => {
    let next = disciple

    // Presence Requirement: away disciples return automatically once their timer elapses.
    if (next.awayUntil !== undefined && next.awayUntil <= now) {
      next = { ...next, awayUntil: undefined }
      anyChanged = true
    }

    // Injury auto-recovery.
    if (next.injuryRecoversAt !== undefined && next.injuryRecoversAt <= now) {
      next = { ...next, injury: 'none', injuryRecoversAt: undefined }
      anyChanged = true
    }

    // Active Cultivation Boost expiry.
    if (next.activeBoostUntil !== undefined && next.activeBoostUntil <= now) {
      next = { ...next, activeBoostUntil: undefined }
      anyChanged = true
    }

    // Away disciples aren't at the sect, so they don't cultivate at all.
    if (next.awayUntil !== undefined) {
      return next
    }

    const realmIndex = CULTIVATION_REALMS.indexOf(next.realm)
    if (realmIndex === CULTIVATION_REALMS.length - 1) {
      // Immortal Ascension — nothing further to cultivate toward.
      return next
    }

    const rate = getDiscipleCultivationRate(next, trainingHallLevel, rateMultiplier)
    const progress = Math.min(100, next.cultivationProgress + rate * deltaSeconds)
    if (progress !== next.cultivationProgress) anyChanged = true
    next = { ...next, cultivationProgress: progress }

    if (progress >= 100) {
      const cost = getBreakthroughCost(realmIndex)
      if (resources.qiStone >= cost) {
        resources = { ...resources, qiStone: resources.qiStone - cost }
        anyChanged = true
        if (Math.random() < getSuccessChance(next.talent)) {
          next = { ...next, realm: CULTIVATION_REALMS[realmIndex + 1], cultivationProgress: 0 }
        } else {
          // Failure is a setback, never permanent loss (doc 03, Section 3).
          next = { ...next, cultivationProgress: Math.max(0, next.cultivationProgress - 40) }
        }
      }
      // Not enough Qi Stone yet — progress holds at 100 until the sect can afford an attempt.
    }

    return next
  })

  return {
    disciples: anyChanged ? disciples : state.disciples,
    resources: anyChanged ? resources : state.resources,
  }
}
