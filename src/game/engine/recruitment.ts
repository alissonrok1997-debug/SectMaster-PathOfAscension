import type { DiscipleGrade, DiscipleInstance, DiscipleRole } from '../types'
import { generateDiscipleName } from '../data/discipleNames'

/** Spirit Stone recruitment cost, scaling with how many disciples are already recruited (doc 03, Section 6/7). */
export function getRecruitmentCost(existingDiscipleCount: number): number {
  return 60 + existingDiscipleCount * 20
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

export function createRecruit(): DiscipleInstance {
  const gradeRoll = rollGrade()
  const role = ROLES[Math.floor(Math.random() * ROLES.length)]

  return {
    id: crypto.randomUUID(),
    name: generateDiscipleName(),
    realm: 'Body Tempering',
    subRealm: 1,
    cultivationProgress: 0,
    talent: randomInRange(gradeRoll.talentRange),
    role,
    grade: gradeRoll.grade,
    loyalty: 70,
    morale: 80,
    health: 100,
    injury: 'none',
    equipment: { weapon: undefined, bodyArmor: undefined, accessory1: undefined, accessory2: undefined },
    knownTechniques: [],
  }
}
