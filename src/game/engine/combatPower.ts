import { CULTIVATION_REALMS, type BattleOutcomeTier, type CombatTrait, type DiscipleGrade, type DiscipleInstance, type InjurySeverity } from '../types'
import { getDiscipleEquipmentCombatPower } from './equipment'
import { getTechniqueCombatPowerBonus } from './techniques'
import { getInjurySeverity } from './injury'
import { hashString } from './rng'

/**
 * Combat leader traits (Combat Polishing Phase 6, #2). Five temperaments, each a distinct trade between how hard the leader's side hits (`powerMult`,
 * applied to that side's power BEFORE the battle → baked into the stored power, so no snapshot field is needed) and how much it bleeds (`ownCasualtyMult`,
 * scaling that side's casualty budget inside the simulator → the trait IS snapshotted, since it changes wounds at regen time). Magnitudes are tuning.
 * For v1 the trait is DERIVED from the disciple id (stable, reproducible, needs no new saved field) and surfaced through `getDiscipleCombatTrait`.
 * The `CombatTrait` union itself lives in types.ts so BattleResult can snapshot it.
 */
export interface CombatTraitEffect {
  label: string
  blurb: string
  powerMult: number
  ownCasualtyMult: number
  /** How readily this leader's side breaks off (Combat Polishing Phase 9, #6) — added to the per-round retreat chance in the simulator. Cautious/defensive pull back to save the squad; aggressive/ruthless dig in. Tuning. */
  retreatBias: number
}

export const TRAIT_EFFECTS: Record<CombatTrait, CombatTraitEffect> = {
  aggressive: { label: 'Aggressive', blurb: 'Hits hard, but leaves the squad exposed.', powerMult: 1.2, ownCasualtyMult: 1.25, retreatBias: -0.07 },
  ruthless: { label: 'Ruthless', blurb: 'Presses every advantage, cost be damned.', powerMult: 1.15, ownCasualtyMult: 1.1, retreatBias: -0.1 },
  inspiring: { label: 'Inspiring', blurb: 'Steadies the whole squad in the fray.', powerMult: 1.15, ownCasualtyMult: 0.9, retreatBias: -0.03 },
  defensive: { label: 'Defensive', blurb: 'Trades reach for far fewer losses.', powerMult: 1.05, ownCasualtyMult: 0.65, retreatBias: 0.08 },
  cautious: { label: 'Cautious', blurb: 'Spends no life it does not have to.', powerMult: 1.0, ownCasualtyMult: 0.5, retreatBias: 0.12 },
}

const TRAIT_ORDER: CombatTrait[] = ['aggressive', 'ruthless', 'inspiring', 'defensive', 'cautious']

/** Each disciple's stable combat trait, derived from their id (v1: no new saved field). */
export function getDiscipleCombatTrait(disciple: { id: string }): CombatTrait {
  return TRAIT_ORDER[(hashString(disciple.id) >>> 0) % TRAIT_ORDER.length]
}

const GRADE_RANK: Record<DiscipleGrade, number> = { Common: 0, Uncommon: 1, Rare: 2, Genius: 3 }

/** Default leader for a defending group (plan: "highest grade"), tie-broken by combat power then id for determinism. Undefined only if the group is empty. */
export function highestGradeLeaderId(disciples: DiscipleInstance[]): string | undefined {
  let best: DiscipleInstance | undefined
  for (const d of disciples) {
    if (
      !best ||
      GRADE_RANK[d.grade] > GRADE_RANK[best.grade] ||
      (GRADE_RANK[d.grade] === GRADE_RANK[best.grade] && getDiscipleCombatPower(d) > getDiscipleCombatPower(best))
    ) {
      best = d
    }
  }
  return best?.id
}

/** Injury reduces combat effectiveness, mirroring the same "penalty not a hard block" principle cultivation.ts uses for its own injury multiplier. */
const INJURY_CP_MULTIPLIER: Record<InjurySeverity, number> = {
  none: 1,
  minor: 0.85,
  major: 0.6,
  critical: 0.3,
}

/** Combatants "excel in missions and combat resolution" (doc 03 §4) — the one role-affinity bonus implemented at MVP scope. */
const COMBATANT_ROLE_BONUS = 1.25

/**
 * Morale → combat-effectiveness multiplier (Combat Polishing Phase 5, #3): a linear map from a floor at morale 0 up to ×1.0 at morale 100
 * (≈×0.73 at 40). The floor means a demoralised army fights weaker but never collapses to nothing — the primary death-spiral guardrail, since
 * a side that keeps losing can still claw back a win. Mirrors how injury already scales CP; exact magnitudes are tuning, not architecture.
 */
const MORALE_CP_FLOOR = 0.55
export function getMoraleCombatMultiplier(morale: number): number {
  const m = Math.max(0, Math.min(100, morale))
  return MORALE_CP_FLOOR + (1 - MORALE_CP_FLOOR) * (m / 100)
}

/**
 * Post-battle morale shift for a participant, now scaled by the outcome tier (Phase 5 → Phase 8): a Crushing win lifts more than a Narrow one, a
 * Catastrophic loss stings more than a Fighting Retreat. Wins still outweigh equivalent losses (wins recover faster than losses erode — a death-spiral
 * guardrail alongside the CP floor). Clamped 0–100.
 */
const TIER_MORALE_DELTA: Record<BattleOutcomeTier, number> = {
  crushing: 12,
  decisive: 8,
  narrow: 4,
  // A stalemate (Phase 9) is mildly demoralising — fought hard, gained nothing — but far gentler than a defeat.
  draw: -2,
  fightingRetreat: -3,
  defeat: -6,
  catastrophic: -12,
}
export function nextMoraleAfterBattle(morale: number, tier: BattleOutcomeTier): number {
  return Math.max(0, Math.min(100, morale + TIER_MORALE_DELTA[tier]))
}

/**
 * Combat Power (doc 06 §2): Cultivation Realm, Talent, Equipment (Wave 5),
 * and Techniques (Wave 6), plus injury, morale (Combat Polishing Phase 5),
 * and Sect Doctrine (Wave 6, `doctrineCombatPowerMult`, defaults to 1 — no
 * change). Formation bonuses are also listed as a CP input in the doc but
 * don't exist as a system yet — omitted rather than faked.
 */
export function getDiscipleCombatPower(disciple: DiscipleInstance, doctrineCombatPowerMult: number = 1): number {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  const base =
    8 * (realmIndex + 1) +
    disciple.talent * 0.4 +
    getDiscipleEquipmentCombatPower(disciple) +
    getTechniqueCombatPowerBonus(disciple)
  const roleBonus = disciple.role === 'Combatant' ? COMBATANT_ROLE_BONUS : 1
  return Math.round(
    base * roleBonus * INJURY_CP_MULTIPLIER[getInjurySeverity(disciple)] * getMoraleCombatMultiplier(disciple.morale) * doctrineCombatPowerMult,
  )
}

/** Squad CP is a flat sum — no squad-composition bonus/penalty at MVP scope (doc 04 §13 explicitly excludes it). */
export function getSquadCombatPower(squad: DiscipleInstance[], doctrineCombatPowerMult: number = 1): number {
  return squad.reduce((sum, disciple) => sum + getDiscipleCombatPower(disciple, doctrineCombatPowerMult), 0)
}
