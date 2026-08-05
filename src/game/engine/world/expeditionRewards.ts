import type { DiscipleInstance, InjurySeverity, Resources } from '../../types'
import { getSquadCombatPower } from '../combatPower'
import { rollInjurySeverity } from '../injury'

/**
 * Converts one completed on-site cycle into a payload, and rolls the danger
 * incident for that cycle (WORLD_MAP_DESIGN §8.4). Takes an injected RNG so the
 * whole thing is deterministic under test — the same seam expeditionRewards is
 * called out for in §11. Exploration reward tables (§6.2) route through existing
 * item/technique/event systems and land in Phase 5; Phase 4 is the gather loop.
 */

/** Threat contributed per danger tier, in squad-Combat-Power-equivalent units (dev-placeholder). */
const DANGER_UNIT = 22

/** Yield kept when a cycle suffers a non-injury setback. */
const REDUCED_YIELD_MULT = 0.5

type RNG = () => number

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Per-cycle incident probability from danger vs. the party's Combat Power (§8.4):
 * a stronger party shrugs off a dangerous site, a weak party in a deep site is
 * frequently in trouble. Clamped so no cycle is ever perfectly safe or a coin-flip
 * death-trap.
 */
export function getIncidentChance(dangerTier: number, squad: DiscipleInstance[]): number {
  const threat = dangerTier * DANGER_UNIT
  if (threat <= 0) return 0
  const squadCP = getSquadCombatPower(squad)
  return clamp(threat / (threat + squadCP), 0.02, 0.6)
}

export interface GatherCycleResult {
  resources: Partial<Resources>
  /** Injury to apply on return, if any (§8.4) — a mid-flight consequence banked with the arrival report. */
  injury?: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }
  /** A one-line incident for the arrival report, if anything notable happened this cycle. */
  incident?: { kind: string; description: string; discipleId?: string }
  /** True when the incident forces the party to break off and head home early (§8.4). */
  forceReturn: boolean
}

function scaleYield(yieldPerVisit: Partial<Resources>, mult: number): Partial<Resources> {
  const out: Partial<Resources> = {}
  for (const [key, amount] of Object.entries(yieldPerVisit) as [keyof Resources, number][]) {
    out[key] = Math.max(0, Math.round(amount * mult))
  }
  return out
}

/**
 * Resolves one gather cycle. Outcomes in ascending severity (§8.4): nothing →
 * reduced yield → injury → forced early return. Party wipe/capture is reserved
 * for the future conflict system and never happens here.
 */
export function resolveGatherCycle(
  yieldPerVisit: Partial<Resources>,
  dangerTier: number,
  squad: DiscipleInstance[],
  rng: RNG = Math.random,
): GatherCycleResult {
  const chance = getIncidentChance(dangerTier, squad)
  if (rng() >= chance) {
    return { resources: { ...yieldPerVisit }, forceReturn: false }
  }

  const severityRoll = rng()
  if (severityRoll < 0.5) {
    return {
      resources: scaleYield(yieldPerVisit, REDUCED_YIELD_MULT),
      incident: { kind: 'setback', description: 'A setback on site cut the haul short.' },
      forceReturn: false,
    }
  }

  // Injure a party member — any of them, since wounds now stack (HEALTH_SYSTEM_PLAN Phase 2). The empty-party guard is
  // defensive only; an expedition always dispatches at least one disciple.
  const victim = squad[Math.floor(rng() * squad.length)]
  if (!victim) {
    return {
      resources: scaleYield(yieldPerVisit, REDUCED_YIELD_MULT),
      incident: { kind: 'setback', description: 'A setback on site cut the haul short.' },
      forceReturn: false,
    }
  }

  const severity = rollInjurySeverity()
  const forceReturn = severityRoll >= 0.85
  return {
    resources: scaleYield(yieldPerVisit, REDUCED_YIELD_MULT),
    injury: { discipleId: victim.id, severity },
    incident: {
      kind: forceReturn ? 'forcedReturn' : 'injury',
      discipleId: victim.id,
      description: forceReturn
        ? `${victim.name} was hurt (${severity}) — the party broke off and turned home.`
        : `${victim.name} was injured (${severity}) but the party pressed on.`,
    },
    forceReturn,
  }
}
