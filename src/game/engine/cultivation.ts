import { CULTIVATION_REALMS, type DiscipleInstance, type EventLogEntry, type GameState, type Resources } from '../types'
import { BOOST_RATE_PER_SECOND } from './cultivationBoost'
import { getResearchCultivationRateMultiplier } from './research'
import { getDoctrineModifiers } from './doctrine'
import { getWorldModifiers } from './world/worldModifiers'
import { INJURY_RECOVERY_MS } from './injury'

/**
 * Cultivation progress, breakthroughs, injury recovery, and Presence
 * Requirement expiry (doc 03, Sections 2-3, 8-9). Layer 1/3-style
 * continuous + periodic checks per doc 09's simulation layering, folded
 * into the same tick as everything else for this prototype's scale.
 */

export const TRAINING_HALL_RATE_PER_LEVEL = 1.0 // % cultivation progress per second, per Training Hall level, at talentFactor 1
const BACKGROUND_RATE = 0.12 // % per second for disciples not in the Training Hall — cultivation never fully stops

/** Small realms (stages) per major realm (doc 03, Section 2). Stages 1-9 fill automatically; stage 9 → next realm is a player-triggered breakthrough. */
export const MAX_SMALL_REALM = 9

const INJURY_MULTIPLIER: Record<DiscipleInstance['injury'], number> = {
  none: 1,
  minor: 0.7,
  major: 0.4,
  critical: 0.1,
}

function getTalentFactor(talent: number): number {
  return 0.5 + talent / 100
}

/** Qi Stone cost for a breakthrough attempt out of the realm at `realmIndex`. */
function getBreakthroughCost(realmIndex: number): number {
  return 15 * (realmIndex + 1)
}

/** Higher Talent raises breakthrough success chance (doc 03, Section 3). */
function getSuccessChance(talent: number): number {
  return Math.min(95, Math.max(15, 50 + (talent - 50) * 0.6)) / 100
}

/**
 * Morale → cultivation-speed band (upkeep consequence, engine/upkeep.ts). Fixed multipliers per band:
 * ≥90 boosts, 51-89 normal, then escalating penalties down to a -50% floor at ≤20 (where departures
 * also become possible).
 */
export function getMoraleCultivationMultiplier(morale: number): number {
  if (morale >= 90) return 1.1
  if (morale >= 51) return 1.0
  if (morale >= 41) return 0.9
  if (morale >= 31) return 0.8
  if (morale >= 21) return 0.7
  return 0.5
}

/** True when a disciple has filled small realm 9 and is waiting on a player-triggered major breakthrough. */
export function isReadyForBreakthrough(disciple: DiscipleInstance): boolean {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  if (realmIndex === CULTIVATION_REALMS.length - 1) return false
  return disciple.subRealm >= MAX_SMALL_REALM && disciple.cultivationProgress >= 100
}

/** Current cultivation progress gained per second for this disciple — the same formula the tick uses, exposed for the UI's rate display. 0 if away or already at the final realm. `rateMultiplier` folds in Research/Doctrine bonuses (defaults to 1, i.e. no change). */
export function getDiscipleCultivationRate(
  disciple: DiscipleInstance,
  trainingHallLevel: number,
  rateMultiplier: number = 1,
): number {
  if (disciple.awayUntil !== undefined) return 0
  if (CULTIVATION_REALMS.indexOf(disciple.realm) === CULTIVATION_REALMS.length - 1) return 0
  // Progress is frozen at small realm 9 until the player triggers the breakthrough — no live rate to show.
  if (isReadyForBreakthrough(disciple)) return 0

  const now = Date.now()
  const isBoosted = disciple.activeBoostUntil !== undefined && disciple.activeBoostUntil > now
  const isTraining = disciple.assignedBuildingId === 'trainingHall' && trainingHallLevel > 0
  const baseRate = isBoosted
    ? BOOST_RATE_PER_SECOND
    : isTraining
      ? TRAINING_HALL_RATE_PER_LEVEL * trainingHallLevel
      : BACKGROUND_RATE

  // Morale (from upkeep, engine/upkeep.ts) shifts cultivation speed by band — boost at >=90 down to
  // a -50% floor at <=20.
  const moraleFactor = getMoraleCultivationMultiplier(disciple.morale)

  return baseRate * getTalentFactor(disciple.talent) * INJURY_MULTIPLIER[disciple.injury] * moraleFactor * rateMultiplier
}

export interface CultivationTickResult {
  disciples: DiscipleInstance[]
  resources: Resources
}

export function applyCultivationTick(state: GameState, deltaMs: number): CultivationTickResult {
  const now = Date.now()
  const deltaSeconds = deltaMs / 1000
  const trainingHallLevel = state.buildings.trainingHall?.level ?? 0
  // getWorldModifiers folds the sect site's cultivation bonus, the province's
  // Spirit Vein, and any active world event into one cultivationSpeedMult (§11.3).
  const rateMultiplier =
    getResearchCultivationRateMultiplier(state) *
    getDoctrineModifiers(state).cultivationRateMult *
    getWorldModifiers(state).cultivationSpeedMult

  let resources = state.resources
  let anyChanged = false

  const disciples = state.disciples.map((disciple) => {
    let next = disciple

    // Presence Requirement: away disciples return automatically once their timer elapses.
    if (next.awayUntil !== undefined && next.awayUntil <= now) {
      next = { ...next, awayUntil: undefined }
      anyChanged = true
    }

    // Injury auto-recovery.
    if (next.injuryRecoversAt !== undefined && next.injuryRecoversAt <= now) {
      next = { ...next, injury: 'none', injuryRecoversAt: undefined }
      anyChanged = true
    }

    // Active Cultivation Boost expiry.
    if (next.activeBoostUntil !== undefined && next.activeBoostUntil <= now) {
      next = { ...next, activeBoostUntil: undefined }
      anyChanged = true
    }

    // Away disciples aren't at the sect, so they don't cultivate at all.
    if (next.awayUntil !== undefined) {
      return next
    }

    const realmIndex = CULTIVATION_REALMS.indexOf(next.realm)
    if (realmIndex === CULTIVATION_REALMS.length - 1) {
      // Immortal Ascension — nothing further to cultivate toward.
      return next
    }

    const rate = getDiscipleCultivationRate(next, trainingHallLevel, rateMultiplier)
    let progress = next.cultivationProgress + rate * deltaSeconds
    let subRealm = next.subRealm

    // Small realms 1-9 advance automatically and for free as progress fills.
    while (progress >= 100 && subRealm < MAX_SMALL_REALM) {
      subRealm += 1
      progress -= 100
    }
    // At small realm 9, progress holds at 100 — the major breakthrough to the next realm is
    // player-triggered (attemptBreakthrough), never automatic.
    if (subRealm >= MAX_SMALL_REALM) {
      progress = Math.min(100, progress)
    }

    if (progress !== next.cultivationProgress || subRealm !== next.subRealm) {
      anyChanged = true
      next = { ...next, cultivationProgress: progress, subRealm }
    }

    return next
  })

  return {
    disciples: anyChanged ? disciples : state.disciples,
    resources: anyChanged ? resources : state.resources,
  }
}

export interface BreakthroughEligibility {
  canBreakthrough: boolean
  reason?: string
  cost: number
  successChance: number
}

/**
 * Single source of truth for whether a disciple can attempt the major breakthrough (small realm 9 →
 * next realm) — reused by both the button and the store guard, mirroring the other getXEligibility fns.
 */
export function getBreakthroughEligibility(state: GameState, discipleId: string): BreakthroughEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  const cost = disciple ? getBreakthroughCost(CULTIVATION_REALMS.indexOf(disciple.realm)) : 0
  const successChance = disciple ? getSuccessChance(disciple.talent) : 0
  const fail = (reason: string): BreakthroughEligibility => ({ canBreakthrough: false, reason, cost, successChance })

  if (!disciple) return fail('Disciple not found.')
  if (disciple.awayUntil !== undefined) return fail('Away on a mission.')
  if (!isReadyForBreakthrough(disciple)) return fail('Not ready — fill small realm 9 first.')
  if (state.resources.qiStone < cost) return fail(`Needs ${cost} Qi Stone.`)

  return { canBreakthrough: true, cost, successChance }
}

export interface BreakthroughAllSummary {
  /** Disciples waiting on a player-triggered breakthrough (small realm 9, not away). */
  readyCount: number
  /** Total Qi Stone to break through every ready disciple at once. */
  totalCost: number
  /** True only when the full batch is affordable — the "Break through all" button is all-or-nothing. */
  canAffordAll: boolean
}

/** Disciples eligible for a player-triggered breakthrough right now (small realm 9, at the sect). */
function getBreakthroughReadyDisciples(state: GameState): DiscipleInstance[] {
  return state.disciples.filter((d) => d.awayUntil === undefined && isReadyForBreakthrough(d))
}

/**
 * Batch summary for the "Break through all" button — how many disciples are ready and the total Qi
 * Stone to advance all of them. `canAffordAll` gates the button: the batch runs all-or-nothing, never
 * a partial run, so a shortfall disables it entirely.
 */
export function getBreakthroughAllSummary(state: GameState): BreakthroughAllSummary {
  const ready = getBreakthroughReadyDisciples(state)
  const totalCost = ready.reduce((sum, d) => sum + getBreakthroughCost(CULTIVATION_REALMS.indexOf(d.realm)), 0)
  return {
    readyCount: ready.length,
    totalCost,
    canAffordAll: ready.length > 0 && state.resources.qiStone >= totalCost,
  }
}

export interface BreakthroughResult {
  disciple: DiscipleInstance
  resources: Resources
  success: boolean
}

/**
 * Applies a player-triggered breakthrough attempt: spend Qi Stone, roll on Talent. Success advances to
 * the next major realm at small realm 1; failure is a setback (progress loss), never permanent (doc 03 §3).
 */
export function resolveBreakthrough(disciple: DiscipleInstance, resources: Resources): BreakthroughResult {
  const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
  const cost = getBreakthroughCost(realmIndex)
  const nextResources = { ...resources, qiStone: resources.qiStone - cost }

  if (Math.random() < getSuccessChance(disciple.talent)) {
    return {
      disciple: { ...disciple, realm: CULTIVATION_REALMS[realmIndex + 1], subRealm: 1, cultivationProgress: 0 },
      resources: nextResources,
      success: true,
    }
  }
  // A failed major breakthrough is a setback plus a Major Injury (doc 03, Section 3/9).
  return {
    disciple: {
      ...disciple,
      cultivationProgress: Math.max(0, disciple.cultivationProgress - 40),
      injury: 'major',
      injuryRecoversAt: Date.now() + INJURY_RECOVERY_MS.major,
    },
    resources: nextResources,
    success: false,
  }
}

export interface BreakthroughAllResult {
  disciples: DiscipleInstance[]
  resources: Resources
  advanced: number
  setback: number
  /** One Sect Chronicle summary line, or undefined when no disciple was attempted. */
  logEntry?: EventLogEntry
}

/**
 * Batch of `resolveBreakthrough` over every ready disciple, threading a single Qi Stone pool through
 * the attempts. Only runs when the whole batch is affordable (guarded by getBreakthroughAllSummary in
 * the store), so each ready disciple is attempted. Returns the untouched arrays when none are ready.
 */
export function resolveBreakthroughAll(state: GameState): BreakthroughAllResult {
  const ready = getBreakthroughReadyDisciples(state)
  if (ready.length === 0) {
    return { disciples: state.disciples, resources: state.resources, advanced: 0, setback: 0 }
  }

  const readyIds = new Set(ready.map((d) => d.id))
  let resources = state.resources
  let advanced = 0
  let setback = 0

  const disciples = state.disciples.map((disciple) => {
    if (!readyIds.has(disciple.id)) return disciple
    const result = resolveBreakthrough(disciple, resources)
    resources = result.resources
    if (result.success) advanced += 1
    else setback += 1
    return result.disciple
  })

  const logEntry: EventLogEntry = {
    id: crypto.randomUUID(),
    source: 'sect',
    defId: 'massBreakthrough',
    name: 'Mass breakthrough',
    text: `${advanced} advanced${setback > 0 ? `, ${setback} setback` : ''}.`,
    resolvedAt: Date.now(),
  }

  return { disciples, resources, advanced, setback, logEntry }
}
