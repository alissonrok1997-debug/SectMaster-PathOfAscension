import type { InjurySeverity, NpcSectTier } from '../../types'
import { hashString, mulberry32 } from '../rng'

/**
 * The battle simulator (FIRST_REALM_PLAN §4.7) — one ruleset, two fidelity
 * modes. Combat is a non-interactive simulation: every prep decision (party,
 * leader, equipment/techniques already on the disciples) is committed before
 * dispatch; the outcome emerges from a seeded roll against a power ratio, not
 * a decided-up-front winner.
 *
 * Wave B only ever has the PLAYER as attacker (dispatched expeditions vs a
 * static NPC's abstract `strength`); Wave C adds the reverse — an NPC climbing
 * or raiding onto the player's seat/outposts — where the PLAYER's home roster
 * is the real, wound-eligible side instead. `attackerParticipants`/
 * `defenderParticipants` are therefore both optional and independent: whichever
 * side is backed by real disciples takes wound rolls, the other (an NPC with
 * no real roster) never does. Exactly one side has real participants in
 * practice — nobody yet fights another real disciple roster (PvP is future).
 */

export interface BattleParticipant {
  id: string
  name: string
}

export interface BattleWound {
  discipleId: string
  severity: Exclude<InjurySeverity, 'none'>
}

export interface BattleOutcome {
  won: boolean
  seed: number
  rounds: number
  attackerPower: number
  defenderPower: number
  wounds: BattleWound[]
}

export interface BattleNarrative {
  outcome: BattleOutcome
  events: string[]
}

/** Past this power ratio the winner is fixed — preparation must always beat luck (design pillar, §4.7). */
const DECISIVE_WIN_RATIO = 1.75
const DECISIVE_LOSS_RATIO = 1 / DECISIVE_WIN_RATIO

/** Linear interpolation across the ambiguous band; the exact curve is tuning, not architecture (§4.7 "Open Wave-B detail"). */
function winProbability(ratio: number): number {
  if (ratio >= DECISIVE_WIN_RATIO) return 1
  if (ratio <= DECISIVE_LOSS_RATIO) return 0
  return (ratio - DECISIVE_LOSS_RATIO) / (DECISIVE_WIN_RATIO - DECISIVE_LOSS_RATIO)
}

/** Mirrors injury.ts's rollInjurySeverity() bands, but seeded (never Math.random — FIRST_REALM_PLAN §12). */
function rollWoundSeverity(rng: () => number): Exclude<InjurySeverity, 'none'> {
  const r = rng()
  if (r < 0.55) return 'minor'
  if (r < 0.9) return 'major'
  return 'critical'
}

/**
 * Closed-form resolver (§4.7) — outcome-only, O(1), for background NPC-vs-NPC
 * in the world sim (Wave C). Shares `winProbability` with the full simulator
 * by construction, so it is calibrated to agree with it by definition rather
 * than by separate tuning.
 */
export function resolveBattleOutcomeOnly(seed: number, attackerPower: number, defenderPower: number): { won: boolean } {
  const rng = mulberry32(seed)
  const ratio = attackerPower / Math.max(1, defenderPower)
  return { won: rng() < winProbability(ratio) }
}

/**
 * Full per-unit simulation (§4.7) — for any battle the player is in or
 * watching. Deterministic given (seed, attackerPower, defenderPower,
 * participant names): re-invoking with the same inputs reproduces an
 * identical outcome AND narrative, which is how BattleReportView regenerates
 * the story from just the stored outcome + seed, with nothing round-by-round
 * persisted (§4.7's "no stored round-by-round log").
 */
export function resolveBattle(params: {
  seed: number
  attackerPower: number
  defenderPower: number
  attackerParticipants?: BattleParticipant[]
  attackerLeaderId?: string
  /** Flavour label for the attacking side when it has no real roster (an NPC) — ignored if `attackerParticipants` has a leader. */
  attackerName?: string
  defenderParticipants?: BattleParticipant[]
  defenderLeaderId?: string
  defenderName: string
}): BattleNarrative {
  const {
    seed,
    attackerPower,
    defenderPower,
    attackerParticipants = [],
    attackerLeaderId,
    attackerName,
    defenderParticipants = [],
    defenderLeaderId,
    defenderName,
  } = params
  const rng = mulberry32(seed)
  const ratio = attackerPower / Math.max(1, defenderPower)
  const won = rng() < winProbability(ratio)
  const rounds = 3 + Math.floor(rng() * 4)
  // How evenly matched the fight was (1 = dead even, 0 = a total blowout either way) — colours wound odds only, never the outcome.
  const closeness = 1 - Math.min(1, Math.abs(ratio - 1))

  const events: string[] = []
  const attackerLeaderName = attackerLeaderId ? attackerParticipants.find((p) => p.id === attackerLeaderId)?.name : undefined
  const defenderLeaderName = defenderLeaderId ? defenderParticipants.find((p) => p.id === defenderLeaderId)?.name : undefined
  events.push(
    attackerLeaderName
      ? `${attackerLeaderName} leads the assault against ${defenderName}.`
      : `${attackerName ?? 'The attacking party'} clashes with ${defenderName}.`,
  )
  if (defenderLeaderName) events.push(`${defenderLeaderName} rallies the defense.`)

  const wounds: BattleWound[] = []
  const attackerWoundChance = won ? 0.15 + closeness * 0.15 : 0.4 + closeness * 0.4
  const defenderWoundChance = won ? 0.4 + closeness * 0.4 : 0.15 + closeness * 0.15
  for (const p of attackerParticipants) {
    if (rng() < attackerWoundChance) {
      const severity = rollWoundSeverity(rng)
      wounds.push({ discipleId: p.id, severity })
      events.push(`${p.name} takes a ${severity} wound.`)
    }
  }
  for (const p of defenderParticipants) {
    if (rng() < defenderWoundChance) {
      const severity = rollWoundSeverity(rng)
      wounds.push({ discipleId: p.id, severity })
      events.push(`${p.name} takes a ${severity} wound.`)
    }
  }

  events.push(won ? `${defenderName}'s defenders break.` : `The attack is repelled.`)

  return {
    outcome: { won, seed, rounds, attackerPower, defenderPower, wounds },
    events,
  }
}

const FACADE_TITLES = ['Elder', 'Deacon', 'Disciple', 'Warden', 'Sentinel', 'Adept']
const FACADE_COUNT_BY_TIER: Record<NpcSectTier, number> = { minor: 3, regional: 4, major: 5, legendary: 6 }

/**
 * A lightweight, deterministic named roster for a background NPC (§4.7's "NPC
 * roster façade") — purely flavour text for the narrative, never persisted and
 * never wound-tracked (NPCs have no real disciples, only the `strength` scalar).
 */
export function generateNpcFacadeName(npcId: string, npcName: string, tier: NpcSectTier, seed: number): string {
  const rng = mulberry32((hashString(npcId) ^ seed) >>> 0)
  const count = FACADE_COUNT_BY_TIER[tier]
  const title = FACADE_TITLES[Math.floor(rng() * FACADE_TITLES.length)]
  return `${title}s of ${npcName} (${count} defenders)`
}
