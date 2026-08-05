import {
  CULTIVATION_REALMS,
  type BattleResult,
  type DiscipleInstance,
  type GameState,
  type InjurySeverity,
  type MissionBoardOffer,
  type MissionLogEntry,
  type MissionOutcome,
  type Resources,
} from '../types'
import { getMissionDef, MISSION_DEFS, type MissionDefinition } from '../data/missionDefs'
import { getSquadCombatPower, nextMoraleAfterBattle } from './combatPower'
import { applyWound, getInjurySeverity, rollInjurySeverity } from './injury'
import { resolveSquadDowned } from './downed'
import { getDoctrineModifiers } from './doctrine'
import { getDiscipleAvailability } from './discipleAvailability'
import { resolveBattle, getOutcomeTier, type BattleParticipant } from './combat/battleSimulator'
import { hashString, mulberry32 } from './rng'

/** Mission Board (doc 04 §8): a limited, periodically-refreshing set of available missions. */
export const MISSION_BOARD_SIZE = 4
export const MISSION_BOARD_REFRESH_MS = 90_000

/** How many resolved missions the Mission Screen keeps around as history. */
const MISSION_LOG_LIMIT = 10

const NON_COMBAT_INJURY_CHANCE_ON_FAILURE = 0.25

/** Same injury-as-performance-penalty principle as combatPower.ts and cultivation.ts, applied to non-combat mission power. */
const MISSION_INJURY_MULTIPLIER: Record<InjurySeverity, number> = {
  none: 1,
  minor: 0.85,
  major: 0.6,
  critical: 0.3,
}

/** Per-disciple contribution to a non-combat mission's success chance — Talent and Realm, the same inputs doc 04 §4 calls out, minus what doesn't exist yet (Equipment, Technique, Doctrine). Exposed so the squad picker can rank disciples by their fit for a non-combat mission. */
export function getDisciplePowerRating(disciple: DiscipleInstance): number {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  const rating = disciple.talent * 0.5 + realmIndex * 8
  return rating * MISSION_INJURY_MULTIPLIER[getInjurySeverity(disciple)]
}

/** Success chance for a non-combat mission (Gathering/Escort), doc 04 §4. A rating of 50 (Talent 50, Body Tempering) is "average" and adds no bonus/penalty. */
export function getMissionSuccessChance(def: MissionDefinition, squad: DiscipleInstance[]): number {
  const avgRating = squad.reduce((sum, d) => sum + getDisciplePowerRating(d), 0) / squad.length
  const bonus = (avgRating - 50) * 0.5
  return Math.min(0.97, Math.max(0.1, def.baseSuccessChance + bonus / 100))
}

export interface MissionResolution {
  outcome: MissionOutcome
  rewardGranted: Partial<Resources>
  injuries: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[]
  /** Present for combat missions only — the shared battle simulator's result, stored on the log entry so the Mission Screen can open a full Battle Report. */
  battleResult?: BattleResult
}

function rollSquadInjuries(
  squad: DiscipleInstance[],
  chancePerDisciple: number,
): { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[] {
  const injuries: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[] = []
  for (const disciple of squad) {
    if (Math.random() < chancePerDisciple) {
      injuries.push({ discipleId: disciple.id, severity: rollInjurySeverity() })
    }
  }
  return injuries
}

/**
 * Resolves one mission's outcome. Hunting (combat) missions now run on the
 * shared battle simulator (Combat Polishing Phase 2) — squad Combat Power vs.
 * the fixed enemy CP through the same seeded resolver expeditions and defenses
 * use, so wounds and (later phases) advantage bands, clustered casualties, and
 * battle reports all apply here for free. Gathering/Escort missions stay on
 * `getMissionSuccessChance` (doc 04 §4) — they aren't battles. Injury is a
 * consequence, never guaranteed and never fatal at MVP scope.
 */
export function resolveMission(
  def: MissionDefinition,
  squad: DiscipleInstance[],
  seed: number,
  doctrineCombatPowerMult: number = 1,
): MissionResolution {
  if (def.isCombat) {
    const squadCombatPower = getSquadCombatPower(squad, doctrineCombatPowerMult)
    const enemyCombatPower = def.enemyCombatPower ?? 0
    const enemyName = def.enemyName ?? def.name
    const narrative = resolveBattle({
      seed,
      attackerPower: squadCombatPower,
      defenderPower: enemyCombatPower,
      attackerParticipants: squad.map((d): BattleParticipant => ({ id: d.id, name: d.name, temperament: d.temperament })),
      defenderName: enemyName,
    })
    const outcome = narrative.outcome
    const victory = outcome.won
    // A mutual retreat (Phase 9) is its own tier and grants no rewards — resolved as a Failure for reward purposes, but framed as a stalemate.
    const tier = outcome.drawn ? 'draw' : getOutcomeTier(victory, squadCombatPower / Math.max(1, enemyCombatPower), outcome.intensity)

    return {
      outcome: victory ? 'Success' : 'Failure',
      rewardGranted: victory ? def.rewardTable : {},
      // Wounds now come from the simulator (at most one per participant), replacing the independent victory/defeat injury rolls.
      injuries: outcome.wounds.map((w) => ({ discipleId: w.discipleId, severity: w.severity })),
      battleResult: {
        won: victory,
        seed: outcome.seed,
        rounds: outcome.rounds,
        attackerPower: outcome.attackerPower,
        defenderPower: outcome.defenderPower,
        wounds: outcome.wounds,
        outcomeTier: tier,
        defenderName: enemyName,
        outcomeSummary: outcome.drawn
          ? `The fight against ${enemyName} ended in a stalemate.`
          : victory
            ? `Defeated ${enemyName}.`
            : `Failed to defeat ${enemyName}.`,
      },
    }
  }

  const successChance = getMissionSuccessChance(def, squad)
  const success = Math.random() < successChance

  return {
    outcome: success ? 'Success' : 'Failure',
    rewardGranted: success ? def.rewardTable : {},
    injuries: success ? [] : rollSquadInjuries(squad, NON_COMBAT_INJURY_CHANCE_ON_FAILURE),
  }
}

/** Combat missions are framed as Victory/Defeat (doc 06 language); non-combat missions as Success/Failure (doc 04 language) — same underlying MissionOutcome. */
export function getOutcomeLabel(def: MissionDefinition, outcome: MissionOutcome): string {
  if (!def.isCombat) return outcome
  return outcome === 'Success' ? 'Victory' : 'Defeat'
}

export interface MissionDispatchEligibility {
  canDispatch: boolean
  reason?: string
}

/** Single source of truth for whether a squad can be dispatched — shared by the Mission Board UI and the store guard, same pattern as getUpgradeEligibility/getBoostEligibility. */
export function getMissionDispatchEligibility(
  state: GameState,
  offer: MissionBoardOffer | undefined,
  squadDiscipleIds: string[],
): MissionDispatchEligibility {
  if (!offer) return { canDispatch: false, reason: 'Mission no longer available.' }
  const def = getMissionDef(offer.defId)

  if (squadDiscipleIds.length < def.squadSizeMin) {
    return {
      canDispatch: false,
      reason: `Needs at least ${def.squadSizeMin} disciple${def.squadSizeMin > 1 ? 's' : ''}.`,
    }
  }
  if (squadDiscipleIds.length > def.squadSizeMax) {
    return { canDispatch: false, reason: `At most ${def.squadSizeMax} disciples allowed.` }
  }

  for (const id of squadDiscipleIds) {
    const disciple = state.disciples.find((d) => d.id === id)
    if (!disciple) return { canDispatch: false, reason: 'Disciple not found.' }
    // Routed through the unified availability check (WORLD_MAP_DESIGN §8.5).
    if (!getDiscipleAvailability(state, id).available) {
      return { canDispatch: false, reason: `${disciple.name} is already away.` }
    }
  }

  return { canDispatch: true }
}

/** Rolls a fresh set of board offers without repeating a definition within the same board. */
export function getRefreshedMissionBoard(now: number): { offers: MissionBoardOffer[]; nextRefreshAt: number } {
  const pool = [...MISSION_DEFS]
  const offers: MissionBoardOffer[] = []
  for (let i = 0; i < MISSION_BOARD_SIZE && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length)
    const [def] = pool.splice(index, 1)
    offers.push({ id: crypto.randomUUID(), defId: def.id })
  }
  return { offers, nextRefreshAt: now + MISSION_BOARD_REFRESH_MS }
}

/** Replaces the whole board at once when its timer expires — simpler than per-slot refresh, same "single queue" simplicity instinct as the construction system. */
export function resolveMissionBoardRefresh(state: GameState, now: number): GameState {
  if (state.missionBoard.nextRefreshAt > now) return state
  return { ...state, missionBoard: getRefreshedMissionBoard(now) }
}

/**
 * Resolves any active mission whose timer has elapsed: rolls the outcome,
 * grants rewards, applies injury, and clears the squad's Presence
 * Requirement (doc 03 §8) so they're available again. Mirrors
 * resolveCompletedConstruction's "sweep whatever's due" shape so it can
 * slot into both the live tick and the offline catch-up loop the same way.
 */
export function resolveCompletedMissions(
  state: GameState,
  now: number,
): { state: GameState; logEntries: MissionLogEntry[] } {
  const due = state.activeMissions.filter((m) => m.endsAt <= now)
  if (due.length === 0) return { state, logEntries: [] }

  let disciples = state.disciples
  let resources = state.resources
  const logEntries: MissionLogEntry[] = []
  // Combat missions whose squad may have taken a 0-HP hit — resolved into downed fates after the loop, on the assembled state (Phase 5).
  const combatDowns: { entry: MissionLogEntry; squadIds: string[]; won: boolean; seed: number }[] = []
  const doctrineCombatPowerMult = getDoctrineModifiers(state).combatPowerMult

  for (const mission of due) {
    const def = getMissionDef(mission.defId)
    const squad = mission.squadDiscipleIds
      .map((id) => disciples.find((d) => d.id === id))
      .filter((d): d is DiscipleInstance => d !== undefined)

    if (squad.length === 0) continue // squad members somehow gone — nothing to resolve, but still drop the mission below

    // Seeded per-mission so the combat resolver is deterministic and the stored battleResult regenerates the identical narrative (invariant: no Math.random in the simulated path).
    const seed = hashString(mission.id) >>> 0
    const resolution = resolveMission(def, squad, seed, doctrineCombatPowerMult)

    if (resolution.outcome === 'Success') {
      const nextResources = { ...resources }
      for (const [key, amount] of Object.entries(resolution.rewardGranted) as [keyof Resources, number][]) {
        nextResources[key] += amount
      }
      resources = nextResources
    }

    const injuryByDiscipleId = new Map(resolution.injuries.map((i) => [i.discipleId, i.severity]))
    // Power-scaled damage (Phase 4): the squad is the attacker, so the enemy (defender) is the dealer — a tougher foe wounds harder. Non-combat missions have no battle → ×1.
    const battle = resolution.battleResult
    const damageRatio = battle ? battle.defenderPower / Math.max(1, battle.attackerPower) : 1

    disciples = disciples.map((d) => {
      if (!mission.squadDiscipleIds.includes(d.id)) return d
      // Battle-aftermath morale (Phase 5/8), scaled by outcome tier — combat missions only; non-combat missions leave morale untouched.
      const tier = resolution.battleResult?.outcomeTier
      const morale = tier ? nextMoraleAfterBattle(d.morale, tier) : d.morale
      const severity = injuryByDiscipleId.get(d.id)
      const base = { ...d, awayUntil: undefined, morale }
      // Every wound lands now (Phase 2 dropped the no-stacking hack) — an already-hurt disciple takes the new hit on top.
      if (severity === undefined) return base
      // Seeded per (mission, disciple) so the HP hit is deterministic (invariant 3), without touching the battle resolver's own RNG stream.
      return applyWound(base, severity, mulberry32((seed ^ hashString(d.id)) >>> 0), damageRatio)
    })

    const entry: MissionLogEntry = {
      id: crypto.randomUUID(),
      defId: def.id,
      missionName: def.name,
      outcome: resolution.outcome,
      squadNames: squad.map((d) => d.name),
      // Snapshot temperaments only for combat missions (those with a battleResult), so the report regenerates the same wound epithets.
      squadTemperaments: resolution.battleResult ? squad.map((d) => d.temperament) : undefined,
      rewardGranted: resolution.rewardGranted,
      injuries: resolution.injuries.map((i) => ({
        name: squad.find((d) => d.id === i.discipleId)?.name ?? 'Unknown',
        severity: i.severity,
      })),
      resolvedAt: now,
      battleResult: resolution.battleResult,
    }
    logEntries.push(entry)
    // A combat mission's squad may have been floored — record it for the post-loop downed resolution (needs the assembled state to clear refs safely).
    if (resolution.battleResult) {
      // "Held the field" for death framing = a win, or a draw where the squad withdrew intact (bodies come home, not left to the enemy).
      const held = resolution.battleResult.won || resolution.battleResult.outcomeTier === 'draw'
      combatDowns.push({ entry, squadIds: mission.squadDiscipleIds, won: held, seed })
    }
  }

  const activeMissions = state.activeMissions.filter((m) => m.endsAt > now)
  const missionLog = [...logEntries, ...state.missionLog].slice(0, MISSION_LOG_LIMIT)

  // Resolve downed squad members (Phase 5) on the assembled state, per battle, so deaths carry the right won/lost framing + squad-scoped morale, and the report shows a last-stand line.
  let nextState: GameState = { ...state, disciples, resources, activeMissions, missionLog }
  for (const down of combatDowns) {
    const result = resolveSquadDowned(nextState, down.squadIds, now, down.seed, { won: down.won })
    nextState = result.state
    if (result.deaths.length > 0 && down.entry.battleResult) down.entry.battleResult.deaths = result.deaths
  }

  return { state: nextState, logEntries }
}
