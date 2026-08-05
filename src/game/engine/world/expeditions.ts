import type {
  BattleOutcomeTier,
  BattleResult,
  DiscipleInstance,
  Expedition,
  ExpeditionLogEntry,
  ExpeditionPayload,
  ExpeditionPurpose,
  GameState,
  InjurySeverity,
  LocationId,
  LocationRuntime,
  PendingRelocationState,
  Resources,
  SectLocation,
} from '../../types'
import { computeStorageCaps } from '../storage'
import { applyWound } from '../injury'
import { resolveSquadDowned } from '../downed'
import { getDiscipleAvailability } from '../discipleAvailability'
import { getSquadCombatPower, getDiscipleCombatTrait, nextMoraleAfterBattle, TRAIT_EFFECTS } from '../combatPower'
import { getDoctrineModifiers } from '../doctrine'
import { BASE_MAX_CONCURRENT_EXPEDITIONS, EXPEDITION_LOG_LIMIT } from '../../data/world/travelConstants'
import { SECT_SITE_DEFS } from '../../data/world/sectSiteDefs'
import { getExpeditionTargetMeta, getLocation, getLocationDefFromState, pristineLocationRuntime } from './worldQueries'
import { resolveGatherCycle } from './expeditionRewards'
import { isWithinInfluence } from './influence'
import { getDefensePower } from './territory'
import { applyConquest } from './relocation'
import {
  resolveBattle,
  generateNpcFacadeName,
  getOutcomeTier,
  TERRAIN_EFFECTS,
  TIER_LOOT_MULT,
  TIER_REPUTATION_DELTA,
  type BattleParticipant,
} from '../combat/battleSimulator'
import { applyReputationDelta } from '../factions'
import { getLocationTerrain } from './terrain'
import { hashString, mulberry32 } from '../rng'
import type { ResourceLocationDefinition } from '../../data/world/landmarkDefs'

/**
 * The Expedition — one primitive, one lifecycle, one resolver (WORLD_MAP_DESIGN
 * §8). `gather`/`claim`(build outpost) shipped in Phase 4/5A; Wave B
 * (FIRST_REALM_PLAN §4.2) adds `survey`, `raid`, and two more `claim` targets
 * (seize an enemy outpost, conquer a sect seat) — all combat-bearing cases
 * route through the battle simulator (§4.7). `explore` stays stubbed (§11).
 *
 * The resolver is a `while`-loop over the phase machine (§8.3), NOT a single `if`:
 * a short expedition or a long offline gap can complete outbound + several cycles
 * + return inside one catch-up chunk, and a single-`if` resolver would need dozens
 * of ticks to drain and would be wrong on offline catch-up.
 */

export function getMaxConcurrentExpeditions(_state: GameState): number {
  return BASE_MAX_CONCURRENT_EXPEDITIONS
}

export interface DispatchEligibility {
  canDispatch: boolean
  reason?: string
}

/** The three `claim` targets by current world state (FIRST_REALM_PLAN §4.2) — re-derived fresh at both dispatch and resolution time, never trusted stale. */
export type ClaimKind = 'buildOutpost' | 'seizeOutpost' | 'claimSeat'

export function getClaimKind(state: GameState, locationId: LocationId): ClaimKind | undefined {
  const site = SECT_SITE_DEFS.find((s) => s.id === locationId)
  if (site) return site.conquerable ? 'claimSeat' : undefined
  const location = getLocation(state, locationId)
  if (!location || location.kind !== 'resource' || !location.upgradePath) return undefined
  const ownerId = location.runtime.ownerId
  if (!ownerId) return 'buildOutpost'
  if (ownerId === 'player') return undefined
  return 'seizeOutpost'
}

/**
 * Whether a resource node's outpost can be claimed right now, independent of any
 * disciple assignment — the pre-dispatch gate the Claim/Seize button reads so it
 * greys out for the same influence/reputation/cost reasons dispatch would reject
 * (FIRST_REALM_PLAN §4.2/§4.6). Seats are out of scope: they claim via the map,
 * not the node list.
 */
export function getOutpostClaimEligibility(state: GameState, locationId: LocationId): DispatchEligibility {
  const kind = getClaimKind(state, locationId)
  if (kind !== 'buildOutpost' && kind !== 'seizeOutpost') {
    return { canDispatch: false, reason: 'This site cannot be claimed as an outpost.' }
  }
  if (!isWithinInfluence(state, locationId)) {
    return { canDispatch: false, reason: "Outside your sect's influence." }
  }
  if (kind === 'buildOutpost') {
    const location = getLocation(state, locationId)
    if (location?.kind !== 'resource' || !location.upgradePath) return { canDispatch: false, reason: 'This site cannot be claimed as an outpost.' }
    const { claimCost, requiredReputation } = location.upgradePath.level1
    if (state.reputation < requiredReputation) {
      return { canDispatch: false, reason: `Requires ${requiredReputation} reputation.` }
    }
    const cantAfford = (Object.entries(claimCost) as [keyof Resources, number][]).some(
      ([key, amount]) => state.resources[key] < amount,
    )
    if (cantAfford) return { canDispatch: false, reason: 'Not enough resources to claim.' }
  }
  return { canDispatch: true }
}

/** A raid needs an owned, non-player target — nothing to steal from a neutral site or your own holdings. */
function getRaidTarget(state: GameState, locationId: LocationId): boolean {
  const site = SECT_SITE_DEFS.find((s) => s.id === locationId)
  const ownerId = site
    ? state.world?.locations[locationId]?.ownerId
    : getLocation(state, locationId)?.runtime.ownerId
  return ownerId !== undefined && ownerId !== 'player'
}

/**
 * Single source of truth for whether an expedition can be dispatched — shared by
 * the LocationDetailPanel / DispatchExpeditionModal and the store guard, same
 * pattern as getMissionDispatchEligibility.
 */
export function getDispatchEligibility(
  state: GameState,
  locationId: LocationId,
  discipleIds: string[],
  purpose: ExpeditionPurpose,
  cycleTarget: number,
): DispatchEligibility {
  if (!state.world || !state.sectLocation) return { canDispatch: false, reason: 'Sect not founded.' }
  if (purpose === 'explore') return { canDispatch: false, reason: 'That expedition type is not available yet.' }
  if (state.world.expeditions.length >= getMaxConcurrentExpeditions(state)) {
    return { canDispatch: false, reason: 'No expedition slots free.' }
  }

  const meta = getExpeditionTargetMeta(state, locationId, purpose)
  if (!meta) return { canDispatch: false, reason: 'Unknown location.' }

  if (discipleIds.length < 1) return { canDispatch: false, reason: 'Assign at least one disciple.' }
  if (discipleIds.length > meta.maxParty) {
    return { canDispatch: false, reason: `At most ${meta.maxParty} disciple${meta.maxParty > 1 ? 's' : ''}.` }
  }
  for (const id of discipleIds) {
    const disciple = state.disciples.find((d) => d.id === id)
    if (!disciple) return { canDispatch: false, reason: 'Disciple not found.' }
    if (!getDiscipleAvailability(state, id).available) {
      return { canDispatch: false, reason: `${disciple.name} is already away.` }
    }
  }

  if (purpose === 'gather') {
    const location = getLocation(state, locationId)
    if (!location || location.kind !== 'resource') return { canDispatch: false, reason: 'This site cannot be worked yet.' }
    if (location.runtime.remainingCapacity <= 0) return { canDispatch: false, reason: 'This node is depleted.' }
    if (cycleTarget < 1) return { canDispatch: false, reason: 'Order at least one cycle.' }
    return { canDispatch: true }
  }

  if (purpose === 'survey') {
    return { canDispatch: true }
  }

  if (purpose === 'raid') {
    if (!getRaidTarget(state, locationId)) return { canDispatch: false, reason: 'Nothing here to raid.' }
    return { canDispatch: true }
  }

  // purpose === 'claim'
  const kind = getClaimKind(state, locationId)
  if (!kind) return { canDispatch: false, reason: 'This site cannot be claimed.' }

  if (kind === 'claimSeat') {
    // Relocation-readiness (§4.2/§9): every OTHER disciple must be home — the whole sect moves.
    const others = state.disciples.filter((d) => !discipleIds.includes(d.id))
    const AWAY_STATES = new Set(['mission', 'expedition', 'garrison'])
    const allHome = others.every((d) => !AWAY_STATES.has(getDiscipleAvailability(state, d.id).heldBy ?? ''))
    if (!allHome) {
      return { canDispatch: false, reason: 'Recall every disciple (missions, expeditions, and garrisons) before conquering a new seat.' }
    }
    return { canDispatch: true }
  }

  // buildOutpost / seizeOutpost: influence/reputation/cost gate, shared with the
  // pre-dispatch Claim button (§4.6).
  return getOutpostClaimEligibility(state, locationId)
}

/** Fresh empty payload for a newly dispatched expedition. */
export function emptyPayload(): ExpeditionPayload {
  return { resources: {}, knowledgeGained: 0, itemsGained: [] }
}

/**
 * Recall (§8.4): flip an in-flight expedition straight to `returning`, keeping the
 * payload accrued so far. Players need an out when they misjudge a dispatch;
 * without it a long mistaken order is pure dead time. Pure — the store commits it.
 */
export function recallExpedition(expeditions: Expedition[], expeditionId: string, now: number): Expedition[] {
  return expeditions.map((e) => {
    if (e.id !== expeditionId || e.phase === 'returning') return e
    return { ...e, phase: 'returning', phaseEndsAt: now + e.outboundMs }
  })
}

/** A raid steals this fraction of the defender's stockpile and chips this fraction of their strength on a win (§4.2). */
const RAID_LOOT_FRACTION = 0.4
const RAID_STRENGTH_CHIP_FRACTION = 0.12
const MIN_NPC_STRENGTH = 5
/** Knowledge gained per completed survey (§4.2), capped at 1 (full knowledge) same as ProvinceRuntime.surveyProgress's scale. */
const SURVEY_KNOWLEDGE_GAIN = 0.25

/**
 * Sweeps every expedition whose phase timer has elapsed, advancing each through
 * outbound → onSite (×cycles) → returning → home in one pass (§8.3). Mirrors
 * resolveCompletedMissions' `(state, now)` shape so it slots into both the live
 * tick and the offline catch-up loop identically. Resource payloads bank on
 * arrival (clamped to storage caps); capacity decrements as each cycle completes;
 * injuries accrued in-flight apply on arrival and free the party's away-lock.
 *
 * Wave B additions thread `npcSects`/`sectLocation`/`pendingRelocation` through
 * alongside the existing `resources`/`disciples`/`locations` accumulators, since
 * a winning seat-claim mutates all of them in one atomic step (FIRST_REALM_PLAN §4.2).
 */
export function resolveCompletedExpeditions(
  state: GameState,
  now: number,
): { state: GameState; logEntries: ExpeditionLogEntry[] } {
  const world = state.world
  if (!world || world.expeditions.length === 0) return { state, logEntries: [] }
  if (!world.expeditions.some((e) => e.phaseEndsAt <= now)) return { state, logEntries: [] }

  const caps = computeStorageCaps(state)
  let resources = { ...state.resources }
  let disciples = state.disciples
  let locations = world.locations
  let npcSects = world.npcSects
  let sectLocation: SectLocation | undefined = state.sectLocation
  let buildings = state.buildings
  let pendingRelocation: PendingRelocationState | undefined = state.pendingRelocation
  let reputation = state.reputation
  const logEntries: ExpeditionLogEntry[] = []
  const stillActive: Expedition[] = []
  // Battle-bearing arrivals whose party may have taken a 0-HP hit — resolved into downed fates after the loop, on the assembled state (Phase 5).
  const combatDowns: { entry: ExpeditionLogEntry; discipleIds: string[]; won: boolean; seed: number }[] = []

  for (const original of world.expeditions) {
    if (original.phaseEndsAt > now) {
      stillActive.push(original)
      continue
    }

    const exp: Expedition = {
      ...original,
      payload: {
        resources: { ...original.payload.resources },
        knowledgeGained: original.payload.knowledgeGained,
        itemsGained: [...original.payload.itemsGained],
      },
      incidents: [...original.incidents],
    }

    const siteDef = SECT_SITE_DEFS.find((s) => s.id === exp.targetLocationId)
    const def = getLocationDefFromState(state, exp.targetLocationId)
    // Unknown target (e.g. a data id retired mid-save): abort home immediately,
    // banking nothing and freeing the party rather than stranding them.
    const resourceDef = def && def.kind === 'resource' ? (def as ResourceLocationDefinition) : undefined

    let party = exp.discipleIds
      .map((id) => disciples.find((d) => d.id === id))
      .filter((d): d is DiscipleInstance => d !== undefined)

    // Wounds land when the fight (or gather cycle) resolves, not on arrival (HEALTH_SYSTEM_PLAN Phase 2): subtract HP from
    // `disciples` immediately and refresh `party` so a later cycle sees the reduced state. A disciple hurt in cycle 2 walks home
    // wounded and starts regenerating on the way. Battle damage is seeded per (expedition, disciple) — invariant 3; gather uses
    // the same Math.random path resolveGatherCycle already runs on.
    const woundDisciple = (id: string, severity: Exclude<InjurySeverity, 'none'>, rng: () => number, powerRatio = 1): void => {
      disciples = disciples.map((d) => (d.id === id ? applyWound(d, severity, rng, powerRatio) : d))
      party = party.map((p) => disciples.find((d) => d.id === p.id) ?? p)
    }
    const battleWoundRng = (id: string): (() => number) => mulberry32(((hashString(exp.id) ^ world.seed) ^ hashString(id)) >>> 0)

    let runtime: LocationRuntime = locations[exp.targetLocationId] ??
      (def
        ? pristineLocationRuntime(def)
        : { discovered: siteDef !== undefined, remainingCapacity: siteDef ? Infinity : 0, lastVisitedAt: 0, visitCount: 0, outpostLevel: 0, knowledge: 0, flags: [] })
    let runtimeTouched = false
    let claimBuildKind: ClaimKind | undefined
    let battleResult: BattleResult | undefined
    let battleTier: BattleOutcomeTier | undefined
    let arrivedHome = false

    // A snapshot reflecting this pass's mutations so far, for the territory/influence
    // helpers that read `state.disciples`/`state.world.*` — reconstructed fresh
    // whenever combat needs a defender-power reading (expeditions are rare enough
    // per tick that this is cheap).
    const snapshot = (): GameState => ({
      ...state,
      disciples,
      resources,
      buildings,
      sectLocation,
      world: { ...world, locations, npcSects },
    })

    while (exp.phaseEndsAt <= now) {
      if (exp.phase === 'outbound') {
        exp.phase = 'onSite'
        exp.phaseEndsAt = exp.phaseEndsAt + exp.onSiteMs
        continue
      }

      if (exp.phase === 'onSite') {
        if (exp.purpose === 'survey') {
          runtime = { ...runtime, discovered: true, knowledge: Math.min(1, runtime.knowledge + SURVEY_KNOWLEDGE_GAIN) }
          runtimeTouched = true
          exp.cyclesCompleted += 1
          exp.phase = 'returning'
          exp.phaseEndsAt = exp.phaseEndsAt + exp.outboundMs
          continue
        }

        if (exp.purpose === 'claim' || exp.purpose === 'raid') {
          const targetOwnerId = runtime.ownerId
          const kind: ClaimKind | undefined = exp.purpose === 'claim' ? getClaimKind(snapshot(), exp.targetLocationId) : undefined
          if (exp.purpose === 'claim') claimBuildKind = kind

          const needsCombat =
            (exp.purpose === 'claim' && (kind === 'seizeOutpost' || kind === 'claimSeat')) ||
            (exp.purpose === 'raid' && targetOwnerId !== undefined && targetOwnerId !== 'player')

          if (needsCombat) {
            const doctrineMult = getDoctrineModifiers(snapshot()).combatPowerMult
            let attackerPower = getSquadCombatPower(party, doctrineMult)
            // The leader's combat trait (Phase 6) sets the attacker's power multiplier, replacing the old flat leader bonus; it also feeds the casualty budget below.
            const leader = exp.leaderId ? party.find((d) => d.id === exp.leaderId) : undefined
            const leaderTrait = leader ? getDiscipleCombatTrait(leader) : undefined
            if (leaderTrait) attackerPower = Math.round(attackerPower * TRAIT_EFFECTS[leaderTrait].powerMult)
            // Terrain (Phase 7) favours the location's holder — here the defender the player is attacking. Baked into defenderPower so it's snapshotted.
            const terrain = getLocationTerrain(exp.targetLocationId)
            const defenderPower = Math.round(getDefensePower(snapshot(), exp.targetLocationId) * TERRAIN_EFFECTS[terrain].defenderPowerMult)
            const defenderNpc = npcSects.find((n) => n.id === targetOwnerId)
            const seed = (hashString(exp.id) ^ world.seed) >>> 0
            const attackerParticipants: BattleParticipant[] = party.map((d) => ({ id: d.id, name: d.name, temperament: d.temperament }))
            const facadeName = defenderNpc
              ? generateNpcFacadeName(defenderNpc.id, defenderNpc.name, defenderNpc.tier, seed)
              : targetOwnerId === 'player'
                ? 'your own forces'
                : 'the defenders'

            const narrative = resolveBattle({
              seed,
              attackerPower,
              defenderPower,
              attackerParticipants,
              attackerLeaderId: exp.leaderId,
              attackerLeaderTrait: leaderTrait,
              terrain,
              defenderName: facadeName,
            })
            const outcome = narrative.outcome
            // Player is the attacker here, so the tier is framed on the attacker's ratio (Phase 8). A mutual retreat (Phase 9) is its own tier — no loot, no conquest, no prestige swing.
            battleTier = outcome.drawn ? 'draw' : getOutcomeTier(outcome.won, attackerPower / Math.max(1, defenderPower), outcome.intensity)
            reputation = applyReputationDelta(reputation, TIER_REPUTATION_DELTA[battleTier])
            // Every wound lands (no worst-only collapsing), applied the moment the fight resolves. The party is the attacker,
            // so the defender is the dealer — power-scaled damage (Phase 4) reads defender/attacker: a tougher holding wounds harder.
            const damageRatio = defenderPower / Math.max(1, attackerPower)
            for (const wound of outcome.wounds) {
              woundDisciple(wound.discipleId, wound.severity, battleWoundRng(wound.discipleId), damageRatio)
            }

            let outcomeSummary = outcome.drawn
              ? 'The battle ended in a bloody stalemate — the party withdrew empty-handed.'
              : outcome.won
                ? 'The battle was won, but there was nothing to claim.'
                : 'The attack failed.'
            let lootedResources: Partial<Resources> | undefined

            if (outcome.won) {
              if (exp.purpose === 'claim' && kind === 'seizeOutpost') {
                runtime = { ...runtime, ownerId: 'player' }
                runtimeTouched = true
                if (defenderNpc) {
                  npcSects = npcSects.map((n) =>
                    n.id === defenderNpc.id ? { ...n, outpostIds: n.outpostIds?.filter((id) => id !== exp.targetLocationId) } : n,
                  )
                }
                outcomeSummary = `Seized ${siteDef?.name ?? def?.name ?? 'the outpost'}.`
              } else if (exp.purpose === 'claim' && kind === 'claimSeat' && defenderNpc && sectLocation) {
                const rel = applyConquest(snapshot(), {
                  now,
                  attackerId: 'player',
                  attackerOldSeatId: sectLocation.sectSiteId,
                  targetSeatId: exp.targetLocationId,
                  defenderId: defenderNpc.id,
                })
                sectLocation = rel.sectLocation
                locations = rel.locations
                npcSects = rel.npcSects
                pendingRelocation = rel.pendingRelocation
                runtimeTouched = false // already folded into `locations` by applyRelocation
                outcomeSummary = `Conquered ${siteDef?.name ?? 'the seat'} — the sect has relocated.`
              } else if (exp.purpose === 'raid' && defenderNpc) {
                lootedResources = {}
                const newStockpile = { ...defenderNpc.stockpile }
                for (const [key, amount] of Object.entries(defenderNpc.stockpile) as [keyof Resources, number][]) {
                  // Loot scales with how decisive the raid was (Phase 8).
                  const take = Math.floor(amount * RAID_LOOT_FRACTION * TIER_LOOT_MULT[battleTier])
                  if (take > 0) {
                    lootedResources[key] = take
                    newStockpile[key] = amount - take
                    exp.payload.resources[key] = (exp.payload.resources[key] ?? 0) + take
                  }
                }
                const chip = Math.round(defenderNpc.strength * RAID_STRENGTH_CHIP_FRACTION)
                npcSects = npcSects.map((n) =>
                  n.id === defenderNpc.id ? { ...n, stockpile: newStockpile, strength: Math.max(MIN_NPC_STRENGTH, n.strength - chip) } : n,
                )
                outcomeSummary = `Raided ${defenderNpc.name} — stole supplies and weakened them.`
              }
            }

            battleResult = {
              won: outcome.won,
              seed: outcome.seed,
              rounds: outcome.rounds,
              attackerPower: outcome.attackerPower,
              defenderPower: outcome.defenderPower,
              wounds: outcome.wounds,
              leaderName: leader?.name,
              leaderTrait,
              terrain,
              outcomeTier: battleTier,
              defenderName: facadeName,
              lootedResources,
              outcomeSummary,
            }
          } else if (exp.purpose === 'claim' && kind === 'buildOutpost') {
            // No defender — existing meaning, cost already deducted at dispatch (store.ts).
          }

          exp.cyclesCompleted += 1
          exp.phase = 'returning'
          exp.phaseEndsAt = exp.phaseEndsAt + exp.outboundMs
          continue
        }

        // gather
        const capacityLeft = runtime.remainingCapacity
        if (!resourceDef || capacityLeft <= 0) {
          exp.phase = 'returning'
          exp.phaseEndsAt = exp.phaseEndsAt + exp.outboundMs
          continue
        }

        const cycle = resolveGatherCycle(resourceDef.yieldPerVisit, resourceDef.dangerTier, party)
        exp.cyclesCompleted += 1
        for (const [key, amount] of Object.entries(cycle.resources) as [keyof Resources, number][]) {
          exp.payload.resources[key] = (exp.payload.resources[key] ?? 0) + amount
        }

        runtime = {
          ...runtime,
          discovered: true,
          remainingCapacity: Math.max(0, capacityLeft - 1),
          visitCount: runtime.visitCount + 1,
          lastVisitedAt: now,
        }
        runtimeTouched = true

        if (cycle.injury) {
          woundDisciple(cycle.injury.discipleId, cycle.injury.severity, Math.random)
        }
        if (cycle.incident) {
          exp.incidents.push({
            cycle: exp.cyclesCompleted,
            kind: cycle.incident.kind,
            discipleId: cycle.incident.discipleId,
            description: cycle.incident.description,
          })
        }

        const doneGathering =
          cycle.forceReturn || exp.cyclesCompleted >= exp.cycleTarget || runtime.remainingCapacity <= 0
        exp.phase = doneGathering ? 'returning' : 'onSite'
        exp.phaseEndsAt = exp.phaseEndsAt + (doneGathering ? exp.outboundMs : exp.onSiteMs)
        continue
      }

      // returning → home: commit the outcome, free + injure the party, log the arrival.
      arrivedHome = true
      if (exp.purpose === 'claim' && claimBuildKind === 'buildOutpost') {
        // Establish the outpost (§5.3); its bonus then flows passively through getWorldModifiers.
        runtime = { ...runtime, discovered: true, outpostLevel: Math.max(runtime.outpostLevel, 1), ownerId: 'player' }
        runtimeTouched = true
      }
      // Always bank whatever accrued in the payload — gather hauls, raid loot; empty for survey/seizeOutpost/claimSeat/buildOutpost.
      for (const [key, amount] of Object.entries(exp.payload.resources) as [keyof Resources, number][]) {
        resources[key] = Math.min(caps[key], resources[key] + amount)
      }
      // Wounds already landed at resolve time; arrival only frees the away-lock and settles battle-aftermath morale.
      disciples = disciples.map((d) => {
        if (!exp.discipleIds.includes(d.id)) return d
        return {
          ...d,
          awayUntil: undefined,
          // Battle-aftermath morale (Phase 5/8), scaled by outcome tier — only when this arrival actually fought; gather/survey leave morale untouched.
          morale: battleTier ? nextMoraleAfterBattle(d.morale, battleTier) : d.morale,
        }
      })
      const entry: ExpeditionLogEntry = {
        id: crypto.randomUUID(),
        purpose: exp.purpose,
        targetLocationId: exp.targetLocationId,
        locationName: def?.name ?? siteDef?.name ?? 'Unknown location',
        discipleNames: party.map((d) => d.name),
        discipleTemperaments: party.map((d) => d.temperament),
        payload: exp.payload,
        incidents: exp.incidents,
        resolvedAt: now,
        battleResult,
      }
      logEntries.push(entry)
      // If this arrival fought, record its party for the post-loop downed resolution (deaths → report last-stand line + squad-scoped morale, Phase 5).
      if (battleResult) {
        // "Held the field" for death framing = a win, or a draw where the party withdrew intact (bodies come home, not left to the enemy).
        const held = battleResult.won || battleResult.outcomeTier === 'draw'
        combatDowns.push({ entry, discipleIds: [...exp.discipleIds], won: held, seed: (hashString(exp.id) ^ world.seed) >>> 0 })
      }
      break
    }

    if (runtimeTouched) {
      locations = { ...locations, [exp.targetLocationId]: runtime }
    }
    if (!arrivedHome) stillActive.push(exp)
  }

  const expeditionLog = [...logEntries, ...world.expeditionLog].slice(0, EXPEDITION_LOG_LIMIT)

  let nextState: GameState = {
    ...state,
    resources,
    disciples,
    buildings,
    sectLocation,
    pendingRelocation,
    reputation,
    world: { ...world, locations, npcSects, expeditions: stillActive, expeditionLog },
  }
  // Resolve downed party members (Phase 5) on the assembled state, per battle — deaths carry won/lost framing + squad-scoped morale, and the arrival report shows a last-stand line.
  for (const down of combatDowns) {
    const result = resolveSquadDowned(nextState, down.discipleIds, now, down.seed, { won: down.won })
    nextState = result.state
    if (result.deaths.length > 0 && down.entry.battleResult) down.entry.battleResult.deaths = result.deaths
  }

  return { state: nextState, logEntries }
}
