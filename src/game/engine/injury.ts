import type { InjurySeverity } from '../types'

/** Recovery time per injury severity (doc 03, Section 9) — dev-placeholder scale, shared by every injury source (mission/combat consequences). */
export const INJURY_RECOVERY_MS: Record<Exclude<InjurySeverity, 'none'>, number> = {
  minor: 15_000,
  major: 30_000,
  critical: 50_000,
}

/** Weighted injury severity roll — Minor common, Major less common, Critical rare, matching doc 03 §9 / doc 06 §7's "severe outcomes should be rare" principle. */
export function rollInjurySeverity(): Exclude<InjurySeverity, 'none'> {
  const roll = Math.random()
  if (roll < 0.55) return 'minor'
  if (roll < 0.9) return 'major'
  return 'critical'
}
