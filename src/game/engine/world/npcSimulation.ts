import type { EventLogEntry, GameState, NpcSect, NpcSectTier, WorldState } from '../../types'
import { REGION_IDENTITY } from '../../data/world/regionIdentityDefs'
import { hashString, mulberry32 } from '../rng'
import { getSite } from './worldAccess'

/**
 * The NPC world (FIRST_REALM_PLAN §4.3, rewritten by MULTIPLAYER_PLAN §6).
 *
 * NPC sects are **defenders only**. They hold the seat they were seeded on, fortify it over time,
 * and slip into decline if something knocks them down — but they never climb, raid, claim outposts,
 * or emerge. Nothing an NPC does changes who owns what; the only thing that moves the map is a
 * player taking a seat, and a defeated NPC is destroyed permanently rather than relocating
 * (MULTIPLAYER_PLAN §0.5-§0.7).
 *
 * That makes a realm's PvE layer finite and monotonically depleting: 24 seeded NPCs on the Good and
 * Normal seats, none on Poor (the player founding/fallback pool), and no respawn. Fortification is
 * what keeps an uncleared seat interesting — clear it now or pay more for it later.
 *
 * `resolveNpcActions(state, now, maxActions)` remains the ONE entry point for both the live 250ms
 * tick (small `maxActions`, only genuinely-due sects) and the offline settle pass (one call, a
 * larger bounded budget).
 */

export const NPC_BASE_ACTION_INTERVAL_MS = 180_000
export const MAX_NPC_ACTIONS_PER_TICK = 8
/** One pulse per sect is enough to service a full offline gap — see the "each sect pulses at most once per call" note below. */
export const OFFLINE_MAX_NPC_PULSES = 40

const EVENT_LOG_LIMIT = 10

const DECLINE_THRESHOLD_BY_TIER: Record<NpcSectTier, number> = { legendary: 90, major: 55, regional: 40, minor: 15 }
const RECOVERY_THRESHOLD_MULT = 1.25
const STRENGTH_GROWTH_BY_TIER: Record<NpcSectTier, number> = { legendary: 5, major: 3.5, regional: 2.5, minor: 1.5 }
const STOCKPILE_GROWTH_BY_TIER: Record<NpcSectTier, number> = { legendary: 60, major: 40, regional: 28, minor: 12 }
const DECLINING_GROWTH_MULT = 0.5
/** Fraction of strength a *declining prestige-seat* sect sheds per pulse — so decline is a real trough (§8 Wave D), not just slowed growth. A declining sect on a safe Poor seat regrows instead. */
const ATTRITION_FRACTION_BY_TIER: Record<NpcSectTier, number> = { legendary: 0.06, major: 0.08, regional: 0.1, minor: 0.12 }
/** Good sites are the endgame walls (§8 Wave D): their holders grow faster and never soften below a high floor. */
const GOOD_SEAT_GROWTH_MULT = 1.3
const GOOD_SEAT_MIN_STRENGTH = 120
const MIN_NPC_STRENGTH = 5

function withLog(state: GameState, now: number, name: string, text: string): { state: GameState; logEntry: EventLogEntry } {
  const logEntry: EventLogEntry = { id: crypto.randomUUID(), source: 'npcSim', defId: 'npcSim', name, text, resolvedAt: now }
  return { state: { ...state, eventLog: [logEntry, ...state.eventLog].slice(0, EVENT_LOG_LIMIT) }, logEntry }
}

function applyPulseGrowth(world: WorldState, sect: NpcSect, rng: () => number): NpcSect {
  const seatTier = getSite(world, sect.seatSiteId).tier
  const identity = REGION_IDENTITY[sect.regionId]

  if (sect.status === 'declining') {
    // Decline is a trough, not a dead end (§4.3 / §8 Wave D): a declining sect still clinging to a
    // prestige seat bleeds strength (attrition → soon conquered by a rival); one that has fallen back
    // to a safe Poor seat slowly regrows and may climb again.
    if (seatTier !== 'poor') {
      const loss = sect.strength * ATTRITION_FRACTION_BY_TIER[sect.tier] * identity.attritionMult * (0.8 + rng() * 0.4)
      return { ...sect, strength: Math.max(MIN_NPC_STRENGTH, Math.round(sect.strength - loss)) }
    }
    const strengthGain = STRENGTH_GROWTH_BY_TIER[sect.tier] * DECLINING_GROWTH_MULT * identity.growthMult * (0.8 + rng() * 0.4)
    const stockpileGain = Math.round(STOCKPILE_GROWTH_BY_TIER[sect.tier] * DECLINING_GROWTH_MULT)
    return {
      ...sect,
      strength: Math.round(sect.strength + strengthGain),
      stockpile: { ...sect.stockpile, spiritStones: (sect.stockpile.spiritStones ?? 0) + stockpileGain },
    }
  }

  const seatMult = seatTier === 'good' ? GOOD_SEAT_GROWTH_MULT : 1
  const strengthGain = STRENGTH_GROWTH_BY_TIER[sect.tier] * identity.growthMult * seatMult * (0.8 + rng() * 0.4)
  const stockpileGain = Math.round(STOCKPILE_GROWTH_BY_TIER[sect.tier] * identity.growthMult)
  let strength = Math.round(sect.strength + strengthGain)
  if (seatTier === 'good') strength = Math.max(strength, GOOD_SEAT_MIN_STRENGTH)
  return {
    ...sect,
    strength,
    stockpile: { ...sect.stockpile, spiritStones: (sect.stockpile.spiritStones ?? 0) + stockpileGain },
  }
}

function updateDeclineStatus(sect: NpcSect): NpcSect {
  const threshold = DECLINE_THRESHOLD_BY_TIER[sect.tier]
  if (sect.status === 'active' && sect.strength < threshold) return { ...sect, status: 'declining' }
  if (sect.status === 'declining' && sect.strength >= threshold * RECOVERY_THRESHOLD_MULT) return { ...sect, status: 'active' }
  return sect
}

function runSectPulse(state: GameState, sectId: string, now: number): { state: GameState; logEntries: EventLogEntry[] } {
  const world = state.world!
  const sect = world.npcSects.find((n) => n.id === sectId)
  if (!sect) return { state, logEntries: [] }

  const seed = (hashString(`${sect.id}:${sect.nextActionAt}`) ^ world.seed) >>> 0
  const rng = mulberry32(seed)

  const nextActionAt = now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6)
  const grown = { ...updateDeclineStatus(applyPulseGrowth(world, sect, rng)), nextActionAt }

  const npcSects = world.npcSects.map((n) => (n.id === sect.id ? grown : n))
  let working: GameState = { ...state, world: { ...world, npcSects } }
  const logEntries: EventLogEntry[] = []

  // Notable sects announce entering/leaving decline (§8 Wave D — decline/recovery feel); minor sects churn silently.
  if (sect.status !== grown.status && sect.tier !== 'minor') {
    const [name, text] =
      grown.status === 'declining'
        ? [`${grown.name} falters`, `${grown.name}'s power wanes; its rivals begin to circle.`]
        : [`${grown.name} recovers`, `${grown.name} has rebuilt its strength and stands active again.`]
    const logged = withLog(working, now, name, text)
    working = logged.state
    logEntries.push(logged.logEntry)
  }

  // MULTIPLAYER_PLAN §0.6: NPC sects are defenders only. A pulse fortifies the seat and updates
  // decline status — it never picks a target. Nothing an NPC does moves the map any more; the only
  // thing that changes ownership is a player taking a seat.
  return { state: working, logEntries }
}

/**
 * The one entry point (§4.3): drains due sects (most-overdue first) up to
 * `maxActions`, running emergence first. The live tick passes a small cap and
 * `now = Date.now()`, so only genuinely-due sects ever act. The offline settle
 * pass passes a larger one-shot cap and the post-gap `now` — since a sect's
 * rescheduled `nextActionAt` is always `> now`, each sect can pulse AT MOST
 * ONCE per call regardless of how long the gap was, which is exactly the
 * "capped, batched settling pass, not a literal replay" the design calls for.
 * Any sect that stays overdue after the budget runs out (in practice: only
 * possible for the live tick if `maxActions` were ever undersized) is snapped
 * forward without acting, so nobody's clock permanently stalls in the past.
 */
export function resolveNpcActions(state: GameState, now: number, maxActions: number): { state: GameState; logEntries: EventLogEntry[] } {
  if (!state.world) return { state, logEntries: [] }
  let working = state
  const logEntries: EventLogEntry[] = []

  let actionsRun = 0
  while (actionsRun < maxActions) {
    const due = working.world!.npcSects.filter((n) => n.nextActionAt <= now)
    if (due.length === 0) break
    due.sort((a, b) => a.nextActionAt - b.nextActionAt)
    const result = runSectPulse(working, due[0].id, now)
    working = result.state
    logEntries.push(...result.logEntries)
    actionsRun++
  }

  if (working.world!.npcSects.some((n) => n.nextActionAt <= now)) {
    working = {
      ...working,
      world: {
        ...working.world!,
        npcSects: working.world!.npcSects.map((n) => (n.nextActionAt <= now ? { ...n, nextActionAt: now + NPC_BASE_ACTION_INTERVAL_MS } : n)),
      },
    }
  }

  return { state: working, logEntries }
}
