import {
  CULTIVATION_REALMS,
  type DiscipleInstance,
  type GameState,
  type InjurySeverity,
  type MissionBoardOffer,
  type MissionLogEntry,
  type MissionOutcome,
  type Resources,
} from '../types'
import { getMissionDef, MISSION_DEFS, type MissionDefinition } from '../data/missionDefs'
import { getSquadCombatPower } from './combatPower'
import { INJURY_RECOVERY_MS, rollInjurySeverity } from './injury'
import { getDoctrineModifiers } from './doctrine'
import { getDiscipleAvailability } from './discipleAvailability'

/** Mission Board (doc 04 §8): a limited, periodically-refreshing set of available missions. */
export const MISSION_BOARD_SIZE = 4
export const MISSION_BOARD_REFRESH_MS = 90_000

/** How many resolved missions the Mission Screen keeps around as history. */
const MISSION_LOG_LIMIT = 10

const NON_COMBAT_INJURY_CHANCE_ON_FAILURE = 0.25
const COMBAT_INJURY_CHANCE_ON_VICTORY = 0.15
const COMBAT_INJURY_CHANCE_ON_DEFEAT = 0.7

/** Same injury-as-performance-penalty principle as combatPower.ts and cultivation.ts, applied to non-combat mission power. */
const MISSION_INJURY_MULTIPLIER: Record<DiscipleInstance['injury'], number> = {
  none: 1,
  minor: 0.85,
  major: 0.6,
  critical: 0.3,
}

/** Per-disciple contribution to a non-combat mission's success chance — Talent and Realm, the same inputs doc 04 §4 calls out, minus what doesn't exist yet (Equipment, Technique, Doctrine). Exposed so the squad picker can rank disciples by their fit for a non-combat mission. */
export function getDisciplePowerRating(disciple: DiscipleInstance): number {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  const rating = disciple.talent * 0.5 + realmIndex * 8
  return rating * MISSION_INJURY_MULTIPLIER[disciple.injury]
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
  squadCombatPower?: number
  enemyCombatPower?: number
}

function rollSquadInjuries(
  squad: DiscipleInstance[],
  chancePerDisciple: number,
): { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[] {
  const injuries: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[] = []
  for (const disciple of squad) {
    if (disciple.injury !== 'none') continue // already injured — don't stack a second injury on top
    if (Math.random() < chancePerDisciple) {
      injuries.push({ discipleId: disciple.id, severity: rollInjurySeverity() })
    }
  }
  return injuries
}

/**
 * Resolves one mission's outcome. Hunting missions compare squad Combat
 * Power against a fixed enemy CP under a randomized variance band (doc 06
 * §5); Gathering/Escort missions roll against `getMissionSuccessChance`
 * (doc 04 §4). Injury is a Failure/Defeat consequence (doc 04 §7, doc 06
 * §7/§12), never guaranteed and never fatal at MVP scope.
 */
export function resolveMission(
  def: MissionDefinition,
  squad: DiscipleInstance[],
  doctrineCombatPowerMult: number = 1,
): MissionResolution {
  if (def.isCombat) {
    const squadCombatPower = getSquadCombatPower(squad, doctrineCombatPowerMult)
    const enemyCombatPower = def.enemyCombatPower ?? 0
    const variance = 0.85 + Math.random() * 0.3
    const victory = squadCombatPower * variance >= enemyCombatPower

    return {
      outcome: victory ? 'Success' : 'Failure',
      rewardGranted: victory ? def.rewardTable : {},
      injuries: rollSquadInjuries(squad, victory ? COMBAT_INJURY_CHANCE_ON_VICTORY : COMBAT_INJURY_CHANCE_ON_DEFEAT),
      squadCombatPower,
      enemyCombatPower,
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
  const doctrineCombatPowerMult = getDoctrineModifiers(state).combatPowerMult

  for (const mission of due) {
    const def = getMissionDef(mission.defId)
    const squad = mission.squadDiscipleIds
      .map((id) => disciples.find((d) => d.id === id))
      .filter((d): d is DiscipleInstance => d !== undefined)

    if (squad.length === 0) continue // squad members somehow gone — nothing to resolve, but still drop the mission below

    const resolution = resolveMission(def, squad, doctrineCombatPowerMult)

    if (resolution.outcome === 'Success') {
      const nextResources = { ...resources }
      for (const [key, amount] of Object.entries(resolution.rewardGranted) as [keyof Resources, number][]) {
        nextResources[key] += amount
      }
      resources = nextResources
    }

    const injuryByDiscipleId = new Map(resolution.injuries.map((i) => [i.discipleId, i.severity]))

    disciples = disciples.map((d) => {
      if (!mission.squadDiscipleIds.includes(d.id)) return d
      const severity = injuryByDiscipleId.get(d.id)
      return {
        ...d,
        awayUntil: undefined,
        injury: severity ?? d.injury,
        injuryRecoversAt: severity ? now + INJURY_RECOVERY_MS[severity] : d.injuryRecoversAt,
      }
    })

    logEntries.push({
      id: crypto.randomUUID(),
      defId: def.id,
      missionName: def.name,
      outcome: resolution.outcome,
      squadNames: squad.map((d) => d.name),
      rewardGranted: resolution.rewardGranted,
      injuries: resolution.injuries.map((i) => ({
        name: squad.find((d) => d.id === i.discipleId)?.name ?? 'Unknown',
        severity: i.severity,
      })),
      resolvedAt: now,
    })
  }

  const activeMissions = state.activeMissions.filter((m) => m.endsAt > now)
  const missionLog = [...logEntries, ...state.missionLog].slice(0, MISSION_LOG_LIMIT)

  return {
    state: { ...state, disciples, resources, activeMissions, missionLog },
    logEntries,
  }
}
