import { CULTIVATION_REALMS, type DiscipleInstance } from '../types'
import { getDiscipleEquipmentCombatPower } from './equipment'
import { getTechniqueCombatPowerBonus } from './techniques'

/** Injury reduces combat effectiveness, mirroring the same "penalty not a hard block" principle cultivation.ts uses for its own injury multiplier. */
const INJURY_CP_MULTIPLIER: Record<DiscipleInstance['injury'], number> = {
  none: 1,
  minor: 0.85,
  major: 0.6,
  critical: 0.3,
}

/** Combatants "excel in missions and combat resolution" (doc 03 §4) — the one role-affinity bonus implemented at MVP scope. */
const COMBATANT_ROLE_BONUS = 1.25

/**
 * Combat Power (doc 06 §2): Cultivation Realm, Talent, Equipment (Wave 5),
 * and Techniques (Wave 6), plus injury state and Sect Doctrine (Wave 6,
 * `doctrineCombatPowerMult`, defaults to 1 — no change). Morale and
 * Formation bonuses are also listed as CP inputs in the doc but don't
 * exist as systems yet — omitted rather than faked.
 */
export function getDiscipleCombatPower(disciple: DiscipleInstance, doctrineCombatPowerMult: number = 1): number {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  const base =
    8 * (realmIndex + 1) +
    disciple.talent * 0.4 +
    getDiscipleEquipmentCombatPower(disciple) +
    getTechniqueCombatPowerBonus(disciple)
  const roleBonus = disciple.role === 'Combatant' ? COMBATANT_ROLE_BONUS : 1
  return Math.round(base * roleBonus * INJURY_CP_MULTIPLIER[disciple.injury] * doctrineCombatPowerMult)
}

/** Squad CP is a flat sum — no squad-composition bonus/penalty at MVP scope (doc 04 §13 explicitly excludes it). */
export function getSquadCombatPower(squad: DiscipleInstance[], doctrineCombatPowerMult: number = 1): number {
  return squad.reduce((sum, disciple) => sum + getDiscipleCombatPower(disciple, doctrineCombatPowerMult), 0)
}
