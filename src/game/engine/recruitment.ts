import { DISCIPLE_TEMPERAMENTS, type DiscipleGrade, type DiscipleInstance, type DiscipleRole, type GameState } from '../types'
import { generateDiscipleName } from '../data/discipleNames'
import { getWorldModifiers } from './world/worldModifiers'
import { getDiscipleAvailability } from './discipleAvailability'
import { removeDiscipleFromRoster } from './roster'
import { MAX_HP } from './injury'

export interface ExpelEligibility {
  canExpel: boolean
  reason?: string
}

/**
 * Whether a disciple can be expelled from the sect. Blocked only while the
 * disciple is exclusively claimed — away on a mission/expedition or stationed as
 * a garrison — since expelling them then would strand a reference in that task
 * (same availability gate as dispatch, engine/discipleAvailability.ts). Assigned,
 * injured, or boosting disciples can be expelled freely.
 */
export function getExpelEligibility(state: GameState, discipleId: string): ExpelEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { canExpel: false, reason: 'Disciple not found.' }
  if (!getDiscipleAvailability(state, discipleId).available) {
    return { canExpel: false, reason: 'Recall this disciple before expelling them.' }
  }
  return { canExpel: true }
}

/**
 * Removes a disciple from the roster, returning any equipped gear to the sect inventory so expelling never
 * destroys items. Delegates to the shared removal core (engine/roster.ts) — same reference-clearing every
 * other departure uses. No-op if the disciple can't currently be expelled (the one caller with a guard).
 */
export function expelDisciple(state: GameState, discipleId: string): GameState {
  if (!getExpelEligibility(state, discipleId).canExpel) return state
  return removeDiscipleFromRoster(state, discipleId, { returnGear: true, reason: 'expelled' })
}

/** Spirit Stone recruitment cost, scaling with how many disciples are already recruited (doc 03, Section 6/7). */
export function getRecruitmentCost(existingDiscipleCount: number): number {
  return 60 + existingDiscipleCount * 20
}

/**
 * Recruitment cost after the sect site's recruitment-rate modifier (§4.2, e.g.
 * Mistfen Hollow +15%) — a higher rate makes each recruit cheaper. Shared by the
 * Recruit button and the store guard so the shown cost and the charged cost never
 * drift, per the eligibility-function convention.
 */
export function getEffectiveRecruitmentCost(state: GameState): number {
  return Math.ceil(getRecruitmentCost(state.disciples.length) / getWorldModifiers(state).recruitmentRateMult)
}

interface GradeRoll {
  grade: DiscipleGrade
  weight: number
  talentRange: [number, number]
}

// Higher grades roll higher Talent on average and are rarer (doc 03, Section 5).
const GRADE_ROLLS: GradeRoll[] = [
  { grade: 'Common', weight: 50, talentRange: [10, 40] },
  { grade: 'Uncommon', weight: 30, talentRange: [30, 55] },
  { grade: 'Rare', weight: 15, talentRange: [50, 75] },
  { grade: 'Genius', weight: 5, talentRange: [70, 95] },
]

const ROLES: DiscipleRole[] = ['Combatant', 'Alchemist', 'Blacksmith', 'Scholar']

function rollGrade(): GradeRoll {
  const totalWeight = GRADE_ROLLS.reduce((sum, r) => sum + r.weight, 0)
  let roll = Math.random() * totalWeight
  for (const gradeRoll of GRADE_ROLLS) {
    if (roll < gradeRoll.weight) return gradeRoll
    roll -= gradeRoll.weight
  }
  return GRADE_ROLLS[0]
}

function randomInRange([min, max]: [number, number]): number {
  return Math.round(min + Math.random() * (max - min))
}

/** `talentMultiplier` folds in the province's Spirit Vein recruit-quality effect (§7.1, defaults to 1). */
export function createRecruit(talentMultiplier: number = 1): DiscipleInstance {
  const gradeRoll = rollGrade()
  const role = ROLES[Math.floor(Math.random() * ROLES.length)]
  const talent = Math.max(1, Math.min(100, Math.round(randomInRange(gradeRoll.talentRange) * talentMultiplier)))

  return {
    id: crypto.randomUUID(),
    name: generateDiscipleName(),
    // Rolled once, at birth, and kept for life (Combat Polishing Phase 3, #8) — random rather than name-derived so same-named disciples read distinctly.
    temperament: DISCIPLE_TEMPERAMENTS[Math.floor(Math.random() * DISCIPLE_TEMPERAMENTS.length)],
    realm: 'Body Tempering',
    subRealm: 1,
    cultivationProgress: 0,
    talent,
    role,
    grade: gradeRoll.grade,
    loyalty: 70,
    morale: 80,
    health: MAX_HP,
    maxHp: MAX_HP,
    equipment: { weapon: undefined, bodyArmor: undefined, accessory1: undefined, accessory2: undefined },
    knownTechniques: [],
  }
}
