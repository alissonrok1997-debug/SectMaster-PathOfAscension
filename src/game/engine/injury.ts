import type { DiscipleInstance, InjurySeverity } from '../types'

/**
 * The health model (HEALTH_SYSTEM_PLAN Phase 1). A disciple's wound state is an
 * HP pool, not a stored band: `getInjurySeverity` derives the band from remaining
 * HP%, so there is a single source of truth. Every wound site routes through
 * `applyWound`, and recovery is a flat regen rate rather than a per-injury timer.
 */

/** Flat max HP for every disciple at Phase 1 (a persisted field so a later phase can derive it from realm/physique without a migration). */
export const MAX_HP = 100

/**
 * HP regenerated per second, as a fraction of max HP. At MAX_HP 100 this is 1.5
 * HP/s, which reproduces the old recovery pacing closely (minor ≈ 10s, major ≈
 * 31s, critical ≈ 55s from a representative wound). Buildings/pills/realm modify
 * this one number instead of three lookup tables.
 */
export const HEALTH_REGEN_PER_SECOND = 0.015

/** Remaining-HP% → injury band. The band is derived, never stored (HEALTH_SYSTEM_PLAN invariant 1). 0 HP is `downed` (Phase 5); until then HP is clamped to ≥1, so `critical` covers the whole low band. */
export function getInjurySeverity(disciple: Pick<DiscipleInstance, 'health' | 'maxHp'>): InjurySeverity {
  const pct = disciple.maxHp > 0 ? disciple.health / disciple.maxHp : 0
  if (pct >= 0.9) return 'none'
  if (pct >= 0.65) return 'minor'
  if (pct >= 0.3) return 'major'
  return 'critical'
}

/** Damage a wound deals, as a fraction of max HP. Calibrated to agree with the band table: a minor hit from full lands in the minor band, major in major, critical in critical. */
const WOUND_DAMAGE_RANGE: Record<Exclude<InjurySeverity, 'none'>, [number, number]> = {
  minor: [0.1, 0.2],
  major: [0.35, 0.6],
  critical: [0.7, 0.95],
}

/** How much stronger a foe has to be to saturate the ±swing — the same decisive-win ratio the battle resolver caps at (battleSimulator DECISIVE_WIN_RATIO), so the scaling maxes out exactly where the outcome does. */
const WOUND_DAMAGE_RATIO_SPAN = Math.log(1.75)
/** ±magnitude at the decisive-ratio edges (HEALTH_SYSTEM_PLAN Phase 4 placeholder: ±40%). Tuning, not architecture. */
const WOUND_DAMAGE_RATIO_SWING = 0.4

/**
 * Magnitude multiplier from *who dealt the wound* (Phase 4): `powerRatio` is the DEALER's power over the WOUNDED side's power,
 * so a stronger foe hits harder (>1) and a weaker one glances (<1). Log-symmetric (a 1.75× advantage and disadvantage are mirror
 * images) and clamped to ±swing at the decisive-ratio edges. `powerRatio` 1 (the default, and every non-battle wound) → ×1.
 */
export function woundDamageScale(powerRatio: number): number {
  const t = Math.max(-1, Math.min(1, Math.log(Math.max(1e-4, powerRatio)) / WOUND_DAMAGE_RATIO_SPAN))
  return 1 + WOUND_DAMAGE_RATIO_SWING * t
}

/**
 * Rolls a wound's damage as a fraction of max HP from the seeded `rng` (never Math.random inside a battle — invariant 3),
 * scaled by `powerRatio` (Phase 4). The band's frequency is untouched — only the HP magnitude shifts — so the wound-rate feel is preserved.
 */
export function rollWoundDamage(severity: Exclude<InjurySeverity, 'none'>, rng: () => number, powerRatio: number = 1): number {
  const [lo, hi] = WOUND_DAMAGE_RANGE[severity]
  return (lo + rng() * (hi - lo)) * woundDamageScale(powerRatio)
}

/** Subtracts a wound's damage from a disciple's HP, floored at 0. Reaching 0 makes them *downed* — resolveDownedDisciples then rolls their fate (Phase 5). `powerRatio` scales magnitude by who dealt it (Phase 4). */
export function applyWound(
  disciple: DiscipleInstance,
  severity: Exclude<InjurySeverity, 'none'>,
  rng: () => number,
  powerRatio: number = 1,
): DiscipleInstance {
  const damage = rollWoundDamage(severity, rng, powerRatio) * disciple.maxHp
  return { ...disciple, health: Math.max(0, disciple.health - damage) }
}

/** Regenerates HP over `elapsedMs` at the flat regen rate, clamped to max HP. Returns the same instance when already full or nothing changes. */
export function applyHealthRegen(disciple: DiscipleInstance, elapsedMs: number): DiscipleInstance {
  if (disciple.health >= disciple.maxHp) return disciple
  const health = Math.min(disciple.maxHp, disciple.health + HEALTH_REGEN_PER_SECOND * disciple.maxHp * (elapsedMs / 1000))
  return health === disciple.health ? disciple : { ...disciple, health }
}

/** Weighted injury severity roll — Minor common, Major less common, Critical rare, matching doc 03 §9 / doc 06 §7's "severe outcomes should be rare" principle. */
export function rollInjurySeverity(): Exclude<InjurySeverity, 'none'> {
  const roll = Math.random()
  if (roll < 0.55) return 'minor'
  if (roll < 0.9) return 'major'
  return 'critical'
}
