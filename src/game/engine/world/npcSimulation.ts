import type {
  EventLogEntry,
  GameState,
  InjurySeverity,
  LocationId,
  LocationRuntime,
  NpcSect,
  NpcSectTier,
  Resources,
  SectSiteId,
  SectSiteTier,
} from '../../types'
import { SECT_SITE_DEFS, getSectSiteDef } from '../../data/world/sectSiteDefs'
import { LANDMARK_DEFS } from '../../data/world/landmarkDefs'
import { hashString, mulberry32 } from '../rng'
import { getSitesInScope, getRegionForSite } from './regionIndex'
import { isWithinNpcInfluence } from './influence'
import { getHomeDisciples, getOutpostDefensePower, getOutpostGarrisonDisciples, getSeatDefensePower } from './territory'
import { applyConquest, getFreePoorSeatIds } from './relocation'
import { getLocationDefFromState, pristineLocationRuntime } from './worldQueries'
import { resolveBattle, resolveBattleOutcomeOnly, type BattleParticipant } from '../combat/battleSimulator'

/**
 * The living NPC world (FIRST_REALM_PLAN §4.3) — NPC sects climb, raid, claim
 * outposts, decline, and (rarely) emerge, entirely off the Simulation Clock,
 * never the cosmetic World Clock. `resolveNpcActions(state, now, maxActions)`
 * is the ONE entry point for both the live 250ms tick (small `maxActions`,
 * only genuinely-due sects) and the offline settle pass (one call, a larger
 * bounded budget) — exactly the "one resolveNpcActions interface" the design
 * calls for.
 *
 * Scaling note: with 32 sect seats total, `npcSects.length` is hard-capped at
 * 32 forever (the one-seat rule), so the "100-200+ sects" scaling discipline
 * in §4.3 is an architectural constraint to honour, not a real load this
 * world ever produces. A literal min-heap would cost more to maintain as
 * serializable save state than it saves here — a plain filter+sort over ≤32
 * entries is the same O(N log N) *in practice* and needs no external mutable
 * structure to keep in sync with the save. Swapping in a real heap later
 * (if a bigger world ever needs it) doesn't change this function's signature.
 */

export const NPC_BASE_ACTION_INTERVAL_MS = 180_000
export const MAX_NPC_ACTIONS_PER_TICK = 8
/** One pulse per sect is enough to service a full offline gap — see the "each sect pulses at most once per call" note below. */
export const OFFLINE_MAX_NPC_PULSES = 40
export const NPC_EMERGENCE_INTERVAL_MS = 86_400_000
const MIN_FREE_POOR_SEATS_FOR_EMERGENCE = 4
const MAX_EMERGENCE_SPAWNS_PER_CALL = 5

const EVENT_LOG_LIMIT = 10

const TIER_RANK: Record<SectSiteTier, number> = { poor: 0, normal: 1, good: 2 }
const DECLINE_THRESHOLD_BY_TIER: Record<NpcSectTier, number> = { legendary: 90, major: 55, regional: 40, minor: 15 }
const RECOVERY_THRESHOLD_MULT = 1.25
const STRENGTH_GROWTH_BY_TIER: Record<NpcSectTier, number> = { legendary: 5, major: 3.5, regional: 2.5, minor: 1.5 }
const STOCKPILE_GROWTH_BY_TIER: Record<NpcSectTier, number> = { legendary: 60, major: 40, regional: 28, minor: 12 }
const DECLINING_GROWTH_MULT = 0.5
const RAID_LOOT_FRACTION = 0.4
const RAID_STRENGTH_CHIP_FRACTION = 0.12
const MIN_NPC_STRENGTH = 5

const INJURY_RANK: Record<Exclude<InjurySeverity, 'none'>, number> = { minor: 1, major: 2, critical: 3 }

const EMPTY_SITE_RUNTIME: LocationRuntime = {
  discovered: false,
  remainingCapacity: Infinity,
  lastVisitedAt: 0,
  visitCount: 0,
  outpostLevel: 0,
  knowledge: 0,
  flags: [],
}

const EMERGENT_NAME_PREFIXES = ['Wandering', 'Fledgling', 'Nameless', 'Lantern', 'Dawnbreak', 'Ashfall', 'Quiet']

function withLog(state: GameState, now: number, name: string, text: string): { state: GameState; logEntry: EventLogEntry } {
  const logEntry: EventLogEntry = { id: crypto.randomUUID(), source: 'npcSim', defId: 'npcSim', name, text, resolvedAt: now }
  return { state: { ...state, eventLog: [logEntry, ...state.eventLog].slice(0, EVENT_LOG_LIMIT) }, logEntry }
}

function commitConquest(
  state: GameState,
  rel: { sectLocation?: GameState['sectLocation']; locations: Record<LocationId, LocationRuntime>; npcSects: NpcSect[]; pendingRelocation?: GameState['pendingRelocation'] },
): GameState {
  return {
    ...state,
    sectLocation: rel.sectLocation ?? state.sectLocation,
    pendingRelocation: rel.pendingRelocation ?? state.pendingRelocation,
    world: { ...state.world!, locations: rel.locations, npcSects: rel.npcSects },
  }
}

/** Mirrors expeditions.ts's arrival wound application: apply only the worst wound per disciple, never downgrade an existing injury. */
function applyWoundsToDisciples(state: GameState, wounds: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[], now: number): GameState {
  if (wounds.length === 0) return state
  const bySeverity = new Map<string, Exclude<InjurySeverity, 'none'>>()
  for (const w of wounds) {
    const existing = bySeverity.get(w.discipleId)
    if (!existing || INJURY_RANK[w.severity] > INJURY_RANK[existing]) bySeverity.set(w.discipleId, w.severity)
  }
  const disciples = state.disciples.map((d) => {
    const severity = bySeverity.get(d.id)
    if (!severity || d.injury !== 'none') return d
    return { ...d, injury: severity, injuryRecoversAt: now + { minor: 15_000, major: 30_000, critical: 50_000 }[severity] }
  })
  return { ...state, disciples }
}

function applyPulseGrowth(sect: NpcSect, rng: () => number): NpcSect {
  const mult = sect.status === 'declining' ? DECLINING_GROWTH_MULT : 1
  const strengthGain = STRENGTH_GROWTH_BY_TIER[sect.tier] * mult * (0.8 + rng() * 0.4)
  const stockpileGain = Math.round(STOCKPILE_GROWTH_BY_TIER[sect.tier] * mult)
  return {
    ...sect,
    strength: Math.round(sect.strength + strengthGain),
    stockpile: { ...sect.stockpile, spiritStones: (sect.stockpile.spiritStones ?? 0) + stockpileGain },
  }
}

function updateDeclineStatus(sect: NpcSect): NpcSect {
  const threshold = DECLINE_THRESHOLD_BY_TIER[sect.tier]
  if (sect.status === 'active' && sect.strength < threshold) return { ...sect, status: 'declining' }
  if (sect.status === 'declining' && sect.strength >= threshold * RECOVERY_THRESHOLD_MULT) return { ...sect, status: 'active' }
  return sect
}

function pickClimbTarget(state: GameState, sect: NpcSect): SectSiteId | undefined {
  const myRank = TIER_RANK[getSectSiteDef(sect.seatSiteId).tier]
  const scope = getSitesInScope(getRegionForSite(sect.seatSiteId)!)
  let best: SectSiteId | undefined
  let bestDefense = Infinity
  for (const siteId of scope) {
    const site = getSectSiteDef(siteId)
    if (!site.conquerable || TIER_RANK[site.tier] <= myRank) continue
    if (!isWithinNpcInfluence(state, sect, siteId)) continue
    const runtime = state.world!.locations[siteId]
    const defense = !runtime?.ownerId
      ? 0
      : runtime.ownerId === 'player'
        ? getSeatDefensePower(state)
        : (state.world!.npcSects.find((n) => n.id === runtime.ownerId)?.strength ?? 0)
    if (defense < bestDefense) {
      bestDefense = defense
      best = siteId
    }
  }
  return best
}

function pickRaidTarget(state: GameState, sect: NpcSect): LocationId | undefined {
  const world = state.world!
  const scope = getSitesInScope(getRegionForSite(sect.seatSiteId)!)
  const seatTargets = scope.filter((id) => {
    const runtime = world.locations[id]
    return runtime?.ownerId && runtime.ownerId !== sect.id && isWithinNpcInfluence(state, sect, id)
  })
  if (seatTargets.length > 0) return seatTargets[0]

  // Small, fixed-size pool (52 nodes total, doesn't grow with sect count) — a direct scan is cheap regardless of N (§4.3's O(N²) warning is about sect-vs-sect scans, not this).
  for (const def of LANDMARK_DEFS) {
    const runtime = world.locations[def.id]
    if (runtime?.ownerId && runtime.ownerId !== sect.id && isWithinNpcInfluence(state, sect, def.id)) return def.id
  }
  return undefined
}

function pickClaimableOutpost(state: GameState, sect: NpcSect): LocationId | undefined {
  const world = state.world!
  for (const def of LANDMARK_DEFS) {
    if (def.kind !== 'resource' || !def.upgradePath) continue
    if (world.locations[def.id]?.ownerId) continue
    if (!isWithinNpcInfluence(state, sect, def.id)) continue
    return def.id
  }
  return undefined
}

function executeClimb(state: GameState, sect: NpcSect, targetSiteId: SectSiteId, now: number, seed: number): { state: GameState; logEntry?: EventLogEntry } {
  const targetName = getSectSiteDef(targetSiteId).name
  const defenderId = state.world!.locations[targetSiteId]?.ownerId

  if (!defenderId) {
    const rel = applyConquest(state, { now, attackerId: sect.id, attackerOldSeatId: sect.seatSiteId, targetSeatId: targetSiteId })
    return withLog(commitConquest(state, rel), now, `${sect.name} climbs`, `${sect.name} moved into the vacant ${targetName}.`)
  }

  if (defenderId === 'player') {
    const defenders = getHomeDisciples(state)
    const narrative = resolveBattle({
      seed,
      attackerPower: sect.strength,
      defenderPower: getSeatDefensePower(state),
      attackerName: sect.name,
      defenderParticipants: defenders.map((d): BattleParticipant => ({ id: d.id, name: d.name })),
      defenderName: 'your sect',
    })
    let nextState = applyWoundsToDisciples(state, narrative.outcome.wounds, now)
    if (!narrative.outcome.won) {
      return withLog(nextState, now, `${sect.name} repelled`, `${sect.name} attacked ${targetName} but was repelled.`)
    }
    const freeSeats = getFreePoorSeatIds(nextState.world!.locations)
    const retreatRng = mulberry32((hashString(`${sect.id}:retreat:${now}`) ^ nextState.world!.seed) >>> 0)
    const playerRetreatSiteId = freeSeats.length > 0 ? freeSeats[Math.floor(retreatRng() * freeSeats.length)] : undefined
    const rel = applyConquest(nextState, {
      now,
      attackerId: sect.id,
      attackerOldSeatId: sect.seatSiteId,
      targetSeatId: targetSiteId,
      defenderId: 'player',
      playerRetreatSiteId,
    })
    nextState = commitConquest(nextState, rel)
    const text = playerRetreatSiteId
      ? `${sect.name} conquered ${targetName}! Your sect retreats to ${getSectSiteDef(playerRetreatSiteId).name} to rebuild.`
      : `${sect.name} conquered ${targetName}!`
    return withLog(nextState, now, `${sect.name} conquers ${targetName}`, text)
  }

  // NPC vs NPC — closed-form, no narrative; a loss is background noise, not worth logging.
  const defenderNpc = state.world!.npcSects.find((n) => n.id === defenderId)
  if (!defenderNpc) return { state }
  const { won } = resolveBattleOutcomeOnly(seed, sect.strength, defenderNpc.strength)
  if (!won) return { state }
  const rel = applyConquest(state, { now, attackerId: sect.id, attackerOldSeatId: sect.seatSiteId, targetSeatId: targetSiteId, defenderId })
  return withLog(commitConquest(state, rel), now, `${sect.name} conquers ${targetName}`, `${sect.name} conquered ${targetName} from ${defenderNpc.name}.`)
}

function executeRaid(state: GameState, sect: NpcSect, targetLocationId: LocationId, now: number, seed: number): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const runtime = world.locations[targetLocationId]!
  const defenderId = runtime.ownerId!
  const isSeat = SECT_SITE_DEFS.some((s) => s.id === targetLocationId)
  const targetName = isSeat ? getSectSiteDef(targetLocationId).name : (getLocationDefFromState(state, targetLocationId)?.name ?? 'a holding')

  if (defenderId === 'player') {
    const defenders = isSeat ? getHomeDisciples(state) : getOutpostGarrisonDisciples(state, targetLocationId)
    const defenderPower = isSeat ? getSeatDefensePower(state) : getOutpostDefensePower(state, targetLocationId)
    const narrative = resolveBattle({
      seed,
      attackerPower: sect.strength,
      defenderPower,
      attackerName: sect.name,
      defenderParticipants: defenders.map((d): BattleParticipant => ({ id: d.id, name: d.name })),
      defenderName: 'your sect',
    })
    let nextState = applyWoundsToDisciples(state, narrative.outcome.wounds, now)
    if (!narrative.outcome.won) {
      return withLog(nextState, now, `${sect.name} raid repelled`, `${sect.name} tried to raid ${targetName} but was repelled.`)
    }
    const resources = { ...nextState.resources }
    for (const key of Object.keys(resources) as (keyof Resources)[]) {
      const take = Math.floor(resources[key] * RAID_LOOT_FRACTION)
      if (take > 0) resources[key] -= take
    }
    nextState = { ...nextState, resources }
    return withLog(nextState, now, `${sect.name} raids your sect`, `${sect.name} raided ${targetName} and made off with supplies.`)
  }

  const defenderNpc = world.npcSects.find((n) => n.id === defenderId)
  if (!defenderNpc) return { state }
  const { won } = resolveBattleOutcomeOnly(seed, sect.strength, defenderNpc.strength)
  if (!won) return { state }
  const stockpile = { ...defenderNpc.stockpile }
  for (const key of Object.keys(stockpile) as (keyof Resources)[]) {
    const amount = stockpile[key] ?? 0
    const take = Math.floor(amount * RAID_LOOT_FRACTION)
    if (take > 0) stockpile[key] = amount - take
  }
  const chip = Math.round(defenderNpc.strength * RAID_STRENGTH_CHIP_FRACTION)
  const npcSects = world.npcSects.map((n) =>
    n.id === defenderNpc.id ? { ...n, stockpile, strength: Math.max(MIN_NPC_STRENGTH, n.strength - chip) } : n,
  )
  const nextState = { ...state, world: { ...world, npcSects } }
  return withLog(nextState, now, `${sect.name} raids ${defenderNpc.name}`, `${sect.name} raided ${defenderNpc.name}'s ${targetName}.`)
}

function executeClaimOutpost(state: GameState, sect: NpcSect, locationId: LocationId): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const def = getLocationDefFromState(state, locationId)
  const base = world.locations[locationId] ?? (def ? pristineLocationRuntime(def) : EMPTY_SITE_RUNTIME)
  const locations = { ...world.locations, [locationId]: { ...base, ownerId: sect.id, outpostLevel: 1 } }
  const npcSects = world.npcSects.map((n) => (n.id === sect.id ? { ...n, outpostIds: [...(n.outpostIds ?? []), locationId] } : n))
  // Routine outposts aren't worth logging — only territorial changes involving a seat or the player are.
  return { state: { ...state, world: { ...world, locations, npcSects } } }
}

function runSectPulse(state: GameState, sectId: string, now: number): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const sect = world.npcSects.find((n) => n.id === sectId)
  if (!sect) return { state }

  const seed = (hashString(`${sect.id}:${sect.nextActionAt}`) ^ world.seed) >>> 0
  const rng = mulberry32(seed)

  let grown = updateDeclineStatus(applyPulseGrowth(sect, rng))
  const nextActionAt = now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6)
  grown = { ...grown, nextActionAt }

  const npcSects = world.npcSects.map((n) => (n.id === sect.id ? grown : n))
  const working: GameState = { ...state, world: { ...world, npcSects } }

  if (grown.status === 'declining') return { state: working }

  const climbTarget = pickClimbTarget(working, grown)
  const raidTarget = pickRaidTarget(working, grown)
  const claimTarget = pickClaimableOutpost(working, grown)

  const options: { kind: 'climb' | 'raid' | 'claim'; weight: number }[] = []
  if (climbTarget) options.push({ kind: 'climb', weight: 0.5 + grown.aggression })
  if (raidTarget) options.push({ kind: 'raid', weight: 0.3 + grown.aggression * 0.8 })
  if (claimTarget) options.push({ kind: 'claim', weight: 0.6 + (1 - grown.aggression) * 0.5 })
  if (options.length === 0) return { state: working }

  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0)
  let roll = rng() * totalWeight
  let chosen = options[options.length - 1].kind
  for (const o of options) {
    if (roll < o.weight) {
      chosen = o.kind
      break
    }
    roll -= o.weight
  }

  if (chosen === 'climb' && climbTarget) return executeClimb(working, grown, climbTarget, now, seed)
  if (chosen === 'raid' && raidTarget) return executeRaid(working, grown, raidTarget, now, seed)
  if (chosen === 'claim' && claimTarget) return executeClaimOutpost(working, grown, claimTarget)
  return { state: working }
}

function trySpawnEmergentSect(state: GameState, now: number, rng: () => number): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const freeSeats = getFreePoorSeatIds(world.locations)
  if (freeSeats.length < MIN_FREE_POOR_SEATS_FOR_EMERGENCE) return { state }

  const seatId = freeSeats[Math.floor(rng() * freeSeats.length)]
  const region = getRegionForSite(seatId)!
  const name = `${EMERGENT_NAME_PREFIXES[Math.floor(rng() * EMERGENT_NAME_PREFIXES.length)]} Sect`
  const sect: NpcSect = {
    id: `emergent-${seatId}-${now}`,
    name,
    tier: 'minor',
    regionId: region,
    seatSiteId: seatId,
    strength: 15 + Math.floor(rng() * 10),
    stockpile: { spiritStones: 40 },
    aggression: 0.2 + rng() * 0.3,
    status: 'active',
    nextActionAt: now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6),
    seatSince: now,
  }
  const locations = { ...world.locations, [seatId]: { ...(world.locations[seatId] ?? EMPTY_SITE_RUNTIME), ownerId: sect.id } }
  const npcSects = [...world.npcSects, sect]
  const nextState: GameState = { ...state, world: { ...world, locations, npcSects } }
  return withLog(nextState, now, `${name} emerges`, `A new sect, ${name}, has formed at ${getSectSiteDef(seatId).name}.`)
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

  let emergenceSpawns = 0
  while (working.world!.nextNpcEmergenceAt <= now && emergenceSpawns < MAX_EMERGENCE_SPAWNS_PER_CALL) {
    const seed = (hashString(`emergence:${working.world!.nextNpcEmergenceAt}`) ^ working.world!.seed) >>> 0
    const result = trySpawnEmergentSect(working, now, mulberry32(seed))
    working = {
      ...result.state,
      world: { ...result.state.world!, nextNpcEmergenceAt: result.state.world!.nextNpcEmergenceAt + NPC_EMERGENCE_INTERVAL_MS },
    }
    if (result.logEntry) logEntries.push(result.logEntry)
    emergenceSpawns++
  }
  if (working.world!.nextNpcEmergenceAt <= now) {
    working = { ...working, world: { ...working.world!, nextNpcEmergenceAt: now + NPC_EMERGENCE_INTERVAL_MS } }
  }

  let actionsRun = 0
  while (actionsRun < maxActions) {
    const due = working.world!.npcSects.filter((n) => n.nextActionAt <= now)
    if (due.length === 0) break
    due.sort((a, b) => a.nextActionAt - b.nextActionAt)
    const result = runSectPulse(working, due[0].id, now)
    working = result.state
    if (result.logEntry) logEntries.push(result.logEntry)
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
