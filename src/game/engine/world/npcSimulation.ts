import type {
  BattleOutcomeTier,
  BattleResult,
  BattleTerrain,
  CombatTrait,
  DiscipleInstance,
  DiscipleTemperament,
  EventLogEntry,
  ExpeditionLogEntry,
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
import { REGION_IDENTITY } from '../../data/world/regionIdentityDefs'
import { EXPEDITION_LOG_LIMIT } from '../../data/world/travelConstants'
import { hashString, mulberry32 } from '../rng'
import { getSitesInScope, getRegionForSite } from './regionIndex'
import { isWithinNpcInfluence } from './influence'
import { getOutpostDefensePower, getOutpostGarrisonDisciples, getSeatDefenders, getSeatDefenseLeaderId, getSeatDefensePower, recallWoundedGarrison } from './territory'
import { applyConquest, getFreePoorSeatIds } from './relocation'
import { getLocationDefFromState, pristineLocationRuntime } from './worldQueries'
import {
  resolveBattle,
  resolveBattleOutcomeOnly,
  getOutcomeTier,
  TERRAIN_EFFECTS,
  TIER_REPUTATION_DELTA,
  type BattleNarrative,
  type BattleParticipant,
} from '../combat/battleSimulator'
import { getDiscipleCombatTrait, highestGradeLeaderId, nextMoraleAfterBattle, TRAIT_EFFECTS } from '../combatPower'
import { applyReputationDelta } from '../factions'
import { getLocationTerrain } from './terrain'
import { applyWound } from '../injury'
import { removeDiscipleFromRoster } from '../roster'
import { resolveSquadDowned } from '../downed'

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
/** Fraction of strength a *declining prestige-seat* sect sheds per pulse — so decline is a real trough (§8 Wave D), not just slowed growth. A declining sect on a safe Poor seat regrows instead. */
const ATTRITION_FRACTION_BY_TIER: Record<NpcSectTier, number> = { legendary: 0.06, major: 0.08, regional: 0.1, minor: 0.12 }
/** Good sites are the endgame walls (§8 Wave D): their holders grow faster and never soften below a high floor. */
const GOOD_SEAT_GROWTH_MULT = 1.3
const GOOD_SEAT_MIN_STRENGTH = 120
/** A rival-held target's effective defence is scaled by this when picking a climb goal — grudges pull a sect toward a slightly tougher seat (§8 Wave D). */
const RIVAL_TARGET_PREFERENCE = 0.6
const RAID_LOOT_FRACTION = 0.4
const RAID_STRENGTH_CHIP_FRACTION = 0.12
const MIN_NPC_STRENGTH = 5

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

/** Defender leader (Phase 6): resolves the commanding disciple's name, trait, and pre-battle power multiplier for a defending group. Empty group / no leader → neutral (×1). */
function resolveDefenderLeader(
  defenders: DiscipleInstance[],
  leaderId: string | undefined,
): { id?: string; name?: string; trait?: CombatTrait; powerMult: number } {
  const leader = leaderId ? defenders.find((d) => d.id === leaderId) : undefined
  const trait = leader ? getDiscipleCombatTrait(leader) : undefined
  return { id: leader?.id, name: leader?.name, trait, powerMult: trait ? TRAIT_EFFECTS[trait].powerMult : 1 }
}

/** Battle-aftermath morale for the player's DEFENDERS (Phase 5/8), scaled by outcome tier. Applied to every defender, wounded or not. */
function applyDefenseMorale(state: GameState, defenders: { id: string }[], tier: BattleOutcomeTier): GameState {
  if (defenders.length === 0) return state
  const ids = new Set(defenders.map((d) => d.id))
  return { ...state, disciples: state.disciples.map((d) => (ids.has(d.id) ? { ...d, morale: nextMoraleAfterBattle(d.morale, tier) } : d)) }
}

/** Reputation ("prestige") swing from a defense outcome (Phase 8) — repelling a raid lifts it, losing your seat catastrophically tanks it. */
function applyBattleReputation(state: GameState, tier: BattleOutcomeTier): GameState {
  return { ...state, reputation: applyReputationDelta(state.reputation, TIER_REPUTATION_DELTA[tier]) }
}

/**
 * Catastrophic-defeat capture (Phase 8, #5): the plan's "captured disciples are lost permanently" — a simple, seeded removal of one defender, no ransom
 * sub-system. This is what gives a lopsided defeat real teeth (reconciling the Phase-4 note that a curbstomp loss produces few casualties): the cost lands
 * as a permanent loss, not as wounds.
 */
function captureDefender(state: GameState, defenders: DiscipleInstance[], seed: number): { state: GameState; capturedName?: string } {
  if (defenders.length === 0) return { state }
  const rng = mulberry32((hashString(`capture:${seed}`) >>> 0))
  const victim = defenders[Math.floor(rng() * defenders.length)]
  // Route through the shared removal core (Phase 5) — this also clears the victim's garrison/mission/expedition refs, fixing the
  // live ref-leak the old `disciples.filter` left behind when an outpost defender was captured. Captured → gear lost with them.
  return { state: removeDiscipleFromRoster(state, victim.id, { returnGear: false, reason: 'captured' }), capturedName: victim.name }
}

/**
 * Applies every wound from a defense battle to the player's disciples — each one lands (no worst-only collapsing, no no-stacking guard; HEALTH_SYSTEM_PLAN Phase 2).
 * Seeded per (battle, disciple) so the HP hit is deterministic (invariant 3), independent of the resolver's own RNG stream. The player is the defender, so
 * `powerRatio` is the attacker's power over the defender's (Phase 4) — a stronger raider wounds harder.
 */
function applyWoundsToDisciples(
  state: GameState,
  wounds: { discipleId: string; severity: Exclude<InjurySeverity, 'none'> }[],
  seed: number,
  powerRatio: number,
): GameState {
  if (wounds.length === 0) return state
  let disciples = state.disciples
  for (const w of wounds) {
    disciples = disciples.map((d) => (d.id === w.discipleId ? applyWound(d, w.severity, mulberry32((seed ^ hashString(d.id)) >>> 0), powerRatio) : d))
  }
  return { ...state, disciples }
}

/**
 * Store a player-as-defender battle report (Combat Polishing Phase 1) into the shared `expeditionLog` feed — the mirror of the attacker reports expeditions.ts
 * writes. `discipleNames` are the DEFENDERS (same order resolveBattle iterated), and `playerRole: 'defender'` + `attackerName` let BattleReportView regenerate the
 * identical narrative. `won` is player-centric, so the player defended successfully exactly when the NPC attacker's roll (`narrative.outcome.won`) failed.
 */
function pushDefenseReport(
  state: GameState,
  now: number,
  params: {
    targetLocationId: LocationId
    locationName: string
    purpose: 'claim' | 'raid'
    attackerName: string
    defenderNames: string[]
    defenderTemperaments: DiscipleTemperament[]
    leaderName?: string
    leaderTrait?: CombatTrait
    terrain?: BattleTerrain
    outcomeTier: BattleOutcomeTier
    narrative: BattleNarrative
    outcomeSummary: string
    lootedResources?: Partial<Resources>
    /** Names of defenders who died this battle (Phase 5) — shown as a last-stand line in the report. */
    deaths?: string[]
  },
): GameState {
  const outcome = params.narrative.outcome
  const battleResult: BattleResult = {
    // Player-centric: they win a defense only when the NPC attacker fails AND it wasn't a mutual retreat (a draw is neither a win nor a loss; Phase 9).
    won: !outcome.won && !outcome.drawn,
    playerRole: 'defender',
    seed: outcome.seed,
    rounds: outcome.rounds,
    attackerPower: outcome.attackerPower,
    defenderPower: outcome.defenderPower,
    wounds: outcome.wounds,
    leaderName: params.leaderName,
    leaderTrait: params.leaderTrait,
    attackerName: params.attackerName,
    terrain: params.terrain,
    outcomeTier: params.outcomeTier,
    defenderName: 'your sect',
    lootedResources: params.lootedResources,
    outcomeSummary: params.outcomeSummary,
    deaths: params.deaths && params.deaths.length > 0 ? params.deaths : undefined,
  }
  const entry: ExpeditionLogEntry = {
    id: crypto.randomUUID(),
    purpose: params.purpose,
    targetLocationId: params.targetLocationId,
    locationName: params.locationName,
    discipleNames: params.defenderNames,
    discipleTemperaments: params.defenderTemperaments,
    payload: { resources: {}, knowledgeGained: 0, itemsGained: [] },
    incidents: [],
    resolvedAt: now,
    battleResult,
  }
  const world = state.world!
  return { ...state, world: { ...world, expeditionLog: [entry, ...world.expeditionLog].slice(0, EXPEDITION_LOG_LIMIT) } }
}

function isRivalOwner(sect: NpcSect, ownerId: string | undefined): boolean {
  return !!ownerId && !!sect.rivalIds && sect.rivalIds.includes(ownerId)
}

function applyPulseGrowth(sect: NpcSect, rng: () => number): NpcSect {
  const seatTier = getSectSiteDef(sect.seatSiteId).tier
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

function pickClimbTarget(state: GameState, sect: NpcSect): SectSiteId | undefined {
  const myRank = TIER_RANK[getSectSiteDef(sect.seatSiteId).tier]
  const scope = getSitesInScope(getRegionForSite(sect.seatSiteId)!)
  let best: SectSiteId | undefined
  let bestScore = Infinity
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
    // Rivalry (§8 Wave D) discounts a rival-held seat's effective defence, so a grudge outweighs a slightly softer neutral target.
    const score = isRivalOwner(sect, runtime?.ownerId) ? defense * RIVAL_TARGET_PREFERENCE : defense
    if (score < bestScore) {
      bestScore = score
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
  if (seatTargets.length > 0) {
    // Prefer settling a grudge (§8 Wave D) over the nearest neutral seat.
    return seatTargets.find((id) => isRivalOwner(sect, world.locations[id]?.ownerId)) ?? seatTargets[0]
  }

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
    const defenders = getSeatDefenders(state)
    const leader = resolveDefenderLeader(defenders, getSeatDefenseLeaderId(state))
    const terrain = getLocationTerrain(targetSiteId)
    const defenderPower = Math.round(getSeatDefensePower(state) * leader.powerMult * TERRAIN_EFFECTS[terrain].defenderPowerMult)
    const narrative = resolveBattle({
      seed,
      attackerPower: sect.strength,
      defenderPower,
      attackerName: sect.name,
      defenderParticipants: defenders.map((d): BattleParticipant => ({ id: d.id, name: d.name, temperament: d.temperament })),
      defenderLeaderId: leader.id,
      defenderLeaderTrait: leader.trait,
      terrain,
      defenderName: 'your sect',
    })
    const outcome = narrative.outcome
    // Player is the defender, so the tier is framed on the defender's ratio (Phase 8). A mutual retreat (Phase 9) is its own tier — the seat is held, but nobody won.
    const tier = outcome.drawn ? 'draw' : getOutcomeTier(!outcome.won, defenderPower / Math.max(1, sect.strength), outcome.intensity)
    let nextState = applyWoundsToDisciples(state, outcome.wounds, seed, outcome.attackerPower / Math.max(1, outcome.defenderPower))
    nextState = applyDefenseMorale(nextState, defenders, tier)
    nextState = applyBattleReputation(nextState, tier)
    // Resolve any defender wounded to 0 (Phase 5) while we still know the squad + outcome — deaths surface in the report, morale scoped to the squad.
    const seatDown = resolveSquadDowned(nextState, defenders.map((d) => d.id), now, seed, { won: !outcome.won })
    nextState = seatDown.state
    const defenderDeaths = seatDown.deaths
    const defenderNames = defenders.map((d) => d.name)
    const defenderTemperaments = defenders.map((d) => d.temperament)
    // A draw leaves the seat in the player's hands, same as a repel — the attacker just broke off too, so it falls into the "seat held" branch with stalemate framing.
    if (!outcome.won) {
      nextState = pushDefenseReport(nextState, now, {
        targetLocationId: targetSiteId,
        locationName: targetName,
        purpose: 'claim',
        attackerName: sect.name,
        defenderNames,
        defenderTemperaments,
        leaderName: leader.name,
        leaderTrait: leader.trait,
        terrain,
        outcomeTier: tier,
        narrative,
        deaths: defenderDeaths,
        outcomeSummary: outcome.drawn
          ? `The clash with ${sect.name} at ${targetName} ended in a stalemate.`
          : `Repelled ${sect.name}'s assault on ${targetName}.`,
      })
      return outcome.drawn
        ? withLog(nextState, now, `${sect.name} fought to a standstill`, `${sect.name} attacked ${targetName}; the fight ended in a stalemate.`)
        : withLog(nextState, now, `${sect.name} repelled`, `${sect.name} attacked ${targetName} but was repelled.`)
    }
    // Catastrophic conquest → a defender is captured for good (Phase 8, #5), on top of losing the seat.
    let capturedNote = ''
    if (tier === 'catastrophic') {
      const captured = captureDefender(nextState, defenders, seed)
      nextState = captured.state
      if (captured.capturedName) capturedNote = ` ${captured.capturedName} was captured.`
    }
    nextState = pushDefenseReport(nextState, now, {
      targetLocationId: targetSiteId,
      locationName: targetName,
      purpose: 'claim',
      attackerName: sect.name,
      defenderNames,
      defenderTemperaments,
      leaderName: leader.name,
      leaderTrait: leader.trait,
      terrain,
      outcomeTier: tier,
      narrative,
      deaths: defenderDeaths,
      outcomeSummary: `${sect.name} conquered ${targetName}.${capturedNote}`,
    })
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
    const text =
      (playerRetreatSiteId
        ? `${sect.name} conquered ${targetName}! Your sect retreats to ${getSectSiteDef(playerRetreatSiteId).name} to rebuild.`
        : `${sect.name} conquered ${targetName}!`) + capturedNote
    return withLog(nextState, now, `${sect.name} conquers ${targetName}`, text)
  }

  // NPC vs NPC — closed-form, no narrative; a loss is background noise, not worth logging.
  const defenderNpc = state.world!.npcSects.find((n) => n.id === defenderId)
  if (!defenderNpc) return { state }
  const { won } = resolveBattleOutcomeOnly(seed, sect.strength, defenderNpc.strength)
  if (!won) return { state }
  const rel = applyConquest(state, { now, attackerId: sect.id, attackerOldSeatId: sect.seatSiteId, targetSeatId: targetSiteId, defenderId })
  const text = isRivalOwner(sect, defenderNpc.id)
    ? `${sect.name} conquered ${targetName}, crushing its rival ${defenderNpc.name}.`
    : `${sect.name} conquered ${targetName} from ${defenderNpc.name}.`
  return withLog(commitConquest(state, rel), now, `${sect.name} conquers ${targetName}`, text)
}

function executeRaid(state: GameState, sect: NpcSect, targetLocationId: LocationId, now: number, seed: number): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const runtime = world.locations[targetLocationId]!
  const defenderId = runtime.ownerId!
  const isSeat = SECT_SITE_DEFS.some((s) => s.id === targetLocationId)
  const targetName = isSeat ? getSectSiteDef(targetLocationId).name : (getLocationDefFromState(state, targetLocationId)?.name ?? 'a holding')

  if (defenderId === 'player') {
    const defenders = isSeat ? getSeatDefenders(state) : getOutpostGarrisonDisciples(state, targetLocationId)
    // Seat defense uses the player's chosen leader; an outpost garrison is led by its highest-grade member (no per-outpost selection UI in v1).
    const leader = resolveDefenderLeader(defenders, isSeat ? getSeatDefenseLeaderId(state) : highestGradeLeaderId(defenders))
    const terrain = getLocationTerrain(targetLocationId)
    const baseDefensePower = isSeat ? getSeatDefensePower(state) : getOutpostDefensePower(state, targetLocationId)
    const defenderPower = Math.round(baseDefensePower * leader.powerMult * TERRAIN_EFFECTS[terrain].defenderPowerMult)
    const narrative = resolveBattle({
      seed,
      attackerPower: sect.strength,
      defenderPower,
      attackerName: sect.name,
      defenderParticipants: defenders.map((d): BattleParticipant => ({ id: d.id, name: d.name, temperament: d.temperament })),
      defenderLeaderId: leader.id,
      defenderLeaderTrait: leader.trait,
      terrain,
      defenderName: 'your sect',
    })
    const outcome = narrative.outcome
    // A mutual retreat (Phase 9) is its own tier — the raid is broken off with no loot, so it falls into the "held" branch with stalemate framing.
    const tier = outcome.drawn ? 'draw' : getOutcomeTier(!outcome.won, defenderPower / Math.max(1, sect.strength), outcome.intensity)
    let nextState = applyWoundsToDisciples(state, outcome.wounds, seed, outcome.attackerPower / Math.max(1, outcome.defenderPower))
    nextState = applyDefenseMorale(nextState, defenders, tier)
    nextState = applyBattleReputation(nextState, tier)
    // Auto-recall wounded garrison members if the outpost has "return when wounded" on (Phase 5) — the seat has no garrison to recall.
    if (!isSeat) {
      nextState = { ...nextState, world: { ...nextState.world!, locations: recallWoundedGarrison(nextState, targetLocationId) } }
    }
    // Resolve any defender wounded to 0 (Phase 5) — deaths surface in the report, morale scoped to the defending squad.
    const raidDown = resolveSquadDowned(nextState, defenders.map((d) => d.id), now, seed, { won: !outcome.won })
    nextState = raidDown.state
    const defenderDeaths = raidDown.deaths
    const defenderNames = defenders.map((d) => d.name)
    const defenderTemperaments = defenders.map((d) => d.temperament)
    if (!outcome.won) {
      nextState = pushDefenseReport(nextState, now, {
        targetLocationId,
        locationName: targetName,
        purpose: 'raid',
        attackerName: sect.name,
        defenderNames,
        defenderTemperaments,
        leaderName: leader.name,
        leaderTrait: leader.trait,
        terrain,
        outcomeTier: tier,
        narrative,
        deaths: defenderDeaths,
        outcomeSummary: outcome.drawn
          ? `${sect.name}'s raid on ${targetName} was fought to a standstill — nothing was taken.`
          : `Repelled ${sect.name}'s raid on ${targetName}.`,
      })
      return outcome.drawn
        ? withLog(nextState, now, `${sect.name} raid stalled`, `${sect.name} tried to raid ${targetName}; the fight ended in a stalemate.`)
        : withLog(nextState, now, `${sect.name} raid repelled`, `${sect.name} tried to raid ${targetName} but was repelled.`)
    }
    const resources = { ...nextState.resources }
    const looted: Partial<Resources> = {}
    for (const key of Object.keys(resources) as (keyof Resources)[]) {
      const take = Math.floor(resources[key] * RAID_LOOT_FRACTION)
      if (take > 0) {
        resources[key] -= take
        looted[key] = take
      }
    }
    nextState = { ...nextState, resources }
    // A catastrophic raid overruns the defenders: one is captured for good (Phase 8, #5).
    let capturedNote = ''
    if (tier === 'catastrophic') {
      const captured = captureDefender(nextState, defenders, seed)
      nextState = captured.state
      if (captured.capturedName) capturedNote = ` ${captured.capturedName} was captured.`
    }
    nextState = pushDefenseReport(nextState, now, {
      targetLocationId,
      locationName: targetName,
      purpose: 'raid',
      attackerName: sect.name,
      defenderNames,
      defenderTemperaments,
      leaderName: leader.name,
      leaderTrait: leader.trait,
      terrain,
      outcomeTier: tier,
      narrative,
      deaths: defenderDeaths,
      outcomeSummary: `${sect.name} raided ${targetName} and made off with supplies.${capturedNote}`,
      lootedResources: Object.keys(looted).length > 0 ? looted : undefined,
    })
    return withLog(nextState, now, `${sect.name} raids your sect`, `${sect.name} raided ${targetName} and made off with supplies.${capturedNote}`)
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
  const raidText = isRivalOwner(sect, defenderNpc.id)
    ? `${sect.name} struck its rival ${defenderNpc.name}, raiding ${targetName}.`
    : `${sect.name} raided ${defenderNpc.name}'s ${targetName}.`
  return withLog(nextState, now, `${sect.name} raids ${defenderNpc.name}`, raidText)
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

function runSectPulse(state: GameState, sectId: string, now: number): { state: GameState; logEntries: EventLogEntry[] } {
  const world = state.world!
  const sect = world.npcSects.find((n) => n.id === sectId)
  if (!sect) return { state, logEntries: [] }

  const seed = (hashString(`${sect.id}:${sect.nextActionAt}`) ^ world.seed) >>> 0
  const rng = mulberry32(seed)

  const nextActionAt = now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6)
  const grown = { ...updateDeclineStatus(applyPulseGrowth(sect, rng)), nextActionAt }

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

  if (grown.status === 'declining') return { state: working, logEntries }

  const climbTarget = pickClimbTarget(working, grown)
  const raidTarget = pickRaidTarget(working, grown)
  const claimTarget = pickClaimableOutpost(working, grown)

  // Region temperament (§8 Wave D) nudges how readily a sect fights vs. quietly expands.
  const aggression = grown.aggression + REGION_IDENTITY[grown.regionId].aggressionBias
  const options: { kind: 'climb' | 'raid' | 'claim'; weight: number }[] = []
  if (climbTarget) options.push({ kind: 'climb', weight: 0.5 + aggression })
  if (raidTarget) options.push({ kind: 'raid', weight: 0.3 + aggression * 0.8 })
  if (claimTarget) options.push({ kind: 'claim', weight: 0.6 + (1 - aggression) * 0.5 })
  if (options.length === 0) return { state: working, logEntries }

  const totalWeight = options.reduce((sum, o) => sum + Math.max(0, o.weight), 0)
  let roll = rng() * totalWeight
  let chosen = options[options.length - 1].kind
  for (const o of options) {
    const w = Math.max(0, o.weight)
    if (roll < w) {
      chosen = o.kind
      break
    }
    roll -= w
  }

  const action =
    chosen === 'climb' && climbTarget
      ? executeClimb(working, grown, climbTarget, now, seed)
      : chosen === 'raid' && raidTarget
        ? executeRaid(working, grown, raidTarget, now, seed)
        : chosen === 'claim' && claimTarget
          ? executeClaimOutpost(working, grown, claimTarget)
          : { state: working }
  if (action.logEntry) logEntries.push(action.logEntry)
  return { state: action.state, logEntries }
}

function trySpawnEmergentSect(state: GameState, now: number, rng: () => number): { state: GameState; logEntry?: EventLogEntry } {
  const world = state.world!
  const freeSeats = getFreePoorSeatIds(world.locations)
  if (freeSeats.length < MIN_FREE_POOR_SEATS_FOR_EMERGENCE) return { state }

  const seatId = freeSeats[Math.floor(rng() * freeSeats.length)]
  const region = getRegionForSite(seatId)!
  const name = `${EMERGENT_NAME_PREFIXES[Math.floor(rng() * EMERGENT_NAME_PREFIXES.length)]} Sect`
  const sectId = `emergent-${seatId}-${now}`
  // A newcomer picks up a mutual grudge with an existing same-region sect (§8 Wave D), so it joins the world's rivalries rather than acting in a vacuum.
  const regionPeers = world.npcSects.filter((n) => n.regionId === region)
  const rival = regionPeers.length > 0 ? regionPeers[Math.floor(rng() * regionPeers.length)] : undefined
  const sect: NpcSect = {
    id: sectId,
    name,
    tier: 'minor',
    regionId: region,
    seatSiteId: seatId,
    strength: 15 + Math.floor(rng() * 10),
    stockpile: { spiritStones: 40 },
    aggression: 0.2 + rng() * 0.3,
    rivalIds: rival ? [rival.id] : undefined,
    status: 'active',
    nextActionAt: now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6),
    seatSince: now,
  }
  const locations = { ...world.locations, [seatId]: { ...(world.locations[seatId] ?? EMPTY_SITE_RUNTIME), ownerId: sect.id } }
  const npcSects = [
    ...world.npcSects.map((n) => (rival && n.id === rival.id ? { ...n, rivalIds: [...(n.rivalIds ?? []), sectId] } : n)),
    sect,
  ]
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
