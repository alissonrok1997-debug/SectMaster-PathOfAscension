import { create } from 'zustand'
import {
  CULTIVATION_REALMS,
  type DiplomaticActionId,
  type EquipmentSlotId,
  type GameState,
  type Resources,
  type SectDoctrineId,
} from '../types'
import { clearSave, loadGame, saveGame } from '../persistence/save'
import { createNewGame } from './initialState'
import { applyProductionTick } from '../engine/production'
import { getEffectiveMaxHp } from '../engine/injury'
import { resolveCompletedConstruction } from '../engine/construction'
import { getUpgradeEligibility } from '../engine/upgradeEligibility'
import { getClaimSlotEligibility, getDemolishEligibility } from '../engine/specializationSlots'
import { computeStorageCaps } from '../engine/storage'
import { getBuildingDef, SECT_HALL_ID } from '../data/buildingDefs'
import {
  applyCultivationTick,
  getBreakthroughAllSummary,
  getBreakthroughEligibility,
  resolveBreakthrough,
  resolveBreakthroughAll,
} from '../engine/cultivation'
import { resolveUpkeepDue } from '../engine/upkeep'
import { computeDiscipleCapacity } from '../engine/discipleCapacity'
import { getAssignEligibility } from '../engine/buildingAssignment'
import { createRecruit, expelDisciple, getEffectiveRecruitmentCost } from '../engine/recruitment'
import { BOOST_COST, BOOST_DURATION_MS, getBoostEligibility } from '../engine/cultivationBoost'
import { applyOfflineCatchUp, emptyOfflineSummary, rewindStateClock, type OfflineSummary } from '../engine/offlineCatchup'
import { resolveLoginStreak } from '../engine/loginStreak'
import { getMissionDispatchEligibility, resolveCompletedMissions, resolveMissionBoardRefresh } from '../engine/missions'
import { markAllReportsRead, markReportRead } from '../engine/combat/reportInbox'
import { resolveDownedDisciples } from '../engine/downed'
import { getMissionDef } from '../data/missionDefs'
import {
  addExistingInstance,
  getCraftEligibility,
  removeInstanceById,
  removeItemFromInventory,
  resolveCompletedCrafting,
} from '../engine/crafting'
import { getEquipEligibility } from '../engine/equipment'
import { getRecipe } from '../data/craftingRecipes'
import { getItemDef } from '../data/itemDefs'
import { MATERIAL_DEFS } from '../data/materialDefs'
import {
  getResearchDurationMs,
  getResearchCraftingDurationMultiplier,
  getResearchEligibility,
  resolveCompletedResearch,
} from '../engine/research'
import { getResearchProjectDef } from '../data/researchProjectDefs'
import { getTeachEligibility, resolveCompletedTeaching } from '../engine/techniques'
import { getTechniqueDef } from '../data/techniqueDefs'
import { applyDiplomaticAction } from '../engine/diplomacy'
import { resolveWorldEventLifecycle } from '../engine/worldEvents'
import { resolveEventChoice as applyEventChoice, resolveEventLifecycle } from '../engine/events'
import { buildInitialWorldState, getFoundingEligibility } from '../engine/world/founding'
import { getSectSiteDef } from '../data/world/sectSiteDefs'
import { getExpeditionTargetMeta, getLocation, getSectSpiritVein } from '../engine/world/worldQueries'
import {
  emptyPayload,
  getClaimKind,
  getDispatchEligibility,
  recallExpedition as recallExpeditionPure,
  resolveCompletedExpeditions,
} from '../engine/world/expeditions'
import { getTravelTime } from '../engine/world/travel'
import { generateProvinceNodes } from '../engine/world/worldGeneration'
import {
  garrisonSite as garrisonSitePure,
  getGarrisonEligibility,
  setGarrisonReturnWhenWounded as setGarrisonReturnWhenWoundedPure,
  ungarrisonSite as ungarrisonSitePure,
} from '../engine/world/territory'
import { MAX_NPC_ACTIONS_PER_TICK, resolveNpcActions } from '../engine/world/npcSimulation'
import type { Expedition, ExpeditionPurpose } from '../types'

const DEBUG_RESOURCE_GRANT: Resources = {
  spiritStones: 200,
  qiStone: 200,
  spiritWood: 200,
  ironEssence: 200,
  spiritHerb: 200,
  knowledge: 200,
}

/** Crafting Recipe Pack Phase 3: per-material amount the debug grant adds — enough to test any single recipe. */
const DEBUG_MATERIAL_GRANT = 60

interface GameStore {
  state: GameState
  offlineSummary: OfflineSummary | null
  dismissOfflineSummary: () => void
  /** Marks one Combat Report Inbox entry read (opening it in the Reports tab). */
  markReportRead: (id: string) => void
  /** Marks every report read, clearing the unread badge. */
  markAllReportsRead: () => void
  /** Advances both clocks by real elapsed ms, applies production/cultivation, resolves finished construction. */
  tick: (deltaMs: number) => void
  /** The one-time, irreversible founding choice (WORLD_MAP_DESIGN §12.2). */
  foundSect: (provinceId: string, sectSiteId: string) => void
  /** Sends a party to a world location on a timed expedition (WORLD_MAP_DESIGN §8). `leaderId` (FIRST_REALM_PLAN §2.6) only matters for Claim/Raid. */
  dispatchExpedition: (
    purpose: ExpeditionPurpose,
    locationId: string,
    discipleIds: string[],
    cycleTarget: number,
    leaderId?: string,
  ) => void
  /** Recalls an in-flight expedition, keeping the payload accrued so far (§8.4). */
  recallExpedition: (expeditionId: string) => void
  /** Marks a reachable province discovered, generating its minor nodes on first view (§5.4). */
  discoverProvince: (provinceId: string) => void
  /** Stations disciples at a player-held outpost as its garrison (FIRST_REALM_PLAN §4.1); the seat defends itself automatically and cannot be garrisoned. */
  garrisonSite: (locationId: string, discipleIds: string[]) => void
  /** Recalls every disciple garrisoned at a location, leaving it undefended. */
  ungarrisonSite: (locationId: string) => void
  /** Toggles a player outpost's "return when wounded" auto-recall (HEALTH_SYSTEM_PLAN Phase 5). */
  setGarrisonReturnWhenWounded: (locationId: string, value: boolean) => void
  /** Sets (or clears, with undefined) the chosen leader for seat defense (Combat Polishing Phase 6). */
  setDefenseLeader: (discipleId: string | undefined) => void
  /** Resolves a pending post-relocation building prune (FIRST_REALM_PLAN §4.2/§7) by demolishing the given specialization buildings down to the new seat's cap. */
  resolveRelocationPrune: (buildingIdsToRemove: string[]) => void
  startUpgrade: (buildingId: string) => void
  claimSpecializationSlot: (buildingId: string) => void
  demolishSpecializationBuilding: (buildingId: string) => void
  recruitDisciple: () => void
  expelDisciple: (discipleId: string) => void
  assignDisciple: (discipleId: string, buildingId: string | undefined) => void
  activateCultivationBoost: (discipleId: string) => void
  attemptBreakthrough: (discipleId: string) => void
  attemptBreakthroughAll: () => void
  dispatchMission: (offerId: string, squadDiscipleIds: string[]) => void
  startCraft: (recipeId: string, quantity?: number) => void
  equipItem: (discipleId: string, instanceId: string) => void
  unequipItem: (discipleId: string, slot: EquipmentSlotId) => void
  useConsumable: (discipleId: string, itemDefId: string) => void
  startResearch: (projectId: string) => void
  teachTechnique: (discipleId: string, techniqueId: string) => void
  chooseDoctrine: (doctrineId: SectDoctrineId) => void
  performDiplomaticAction: (factionId: string, actionId: DiplomaticActionId) => void
  resolveEventChoice: (choiceIndex: number) => void
  saveNow: () => void
  reloadFromSave: () => void
  resetSave: () => void
  debugAddResources: () => void
  debugAddMaterials: () => void
  debugDamageSectHall: () => void
  debugSimulateOfflineGap: (hours: number) => void
  debugForceWorldEvent: () => void
  debugForceEvent: () => void
}

/**
 * Runs the Offline Simulation Rules (doc 09) against whatever was on disk, then resolves the daily
 * login streak (doc 11 Section 19) on top, then immediately persists the result so a fast repeat
 * reload can't reprocess the same gap. Brand new games skip offline catch-up (there's nothing to
 * have missed) but still resolve the login streak, so a first-ever session shows a Day 1 bonus.
 */
function initializeGame(): { state: GameState; offlineSummary: OfflineSummary | null } {
  const existing = loadGame()
  const now = Date.now()

  let state = existing ?? createNewGame()
  let summary: OfflineSummary | null = null
  if (existing) {
    const catchUp = applyOfflineCatchUp(existing)
    state = catchUp.state
    summary = catchUp.summary
  }

  const streak = resolveLoginStreak(state, now)
  state = streak.state
  if (streak.streakChanged) {
    summary = { ...(summary ?? emptyOfflineSummary()), loginStreakBonus: streak.bonus ?? undefined }
  }

  saveGame(state)
  return { state, offlineSummary: summary }
}

export const useGameStore = create<GameStore>((set) => ({
  ...initializeGame(),

  tick: (deltaMs) =>
    set((store) => {
      // The simulation is frozen until the sect is founded — the FoundingScreen
      // is pre-game and nothing (production, cultivation, events) should accrue
      // against the not-yet-founded starting sect (§12.2).
      if (!store.state.sectLocation) return {}
      const now = Date.now()
      const buildings = resolveCompletedConstruction(store.state.buildings, now)
      const stateAfterConstruction = { ...store.state, buildings }
      const { state: stateAfterCrafting } = resolveCompletedCrafting(stateAfterConstruction, now)
      const { state: stateAfterResearch } = resolveCompletedResearch(stateAfterCrafting, now)
      const { disciples: disciplesAfterTeaching } = resolveCompletedTeaching(stateAfterResearch.disciples, now)
      const stateAfterTeaching = { ...stateAfterResearch, disciples: disciplesAfterTeaching }
      const stateAfterMissionBoard = resolveMissionBoardRefresh(stateAfterTeaching, now)
      const { state: stateAfterMissions } = resolveCompletedMissions(stateAfterMissionBoard, now)
      // Expeditions resolve where territory claims used to sit (§11.2): a one-shot
      // completion resolver, run after missions (so a freed disciple is consistent)
      // and before production/cultivation (a returning claim expedition establishes
      // an outpost whose bonus those accumulators consume this same tick).
      const { state: stateAfterExpeditions } = resolveCompletedExpeditions(stateAfterMissions, now)
      // The living NPC world (FIRST_REALM_PLAN §4.3): drains only genuinely-due sects, bounded per tick.
      const { state: stateAfterNpcSim } = resolveNpcActions(stateAfterExpeditions, now, MAX_NPC_ACTIONS_PER_TICK)
      // Resolve any disciple wounded to 0 HP this tick (Phase 5) — after every wound-producing resolver, so ref-clearing sees a coherent state.
      const { state: stateAfterDowned } = resolveDownedDisciples(stateAfterNpcSim, now, now >>> 0)
      const { state: stateAfterWorldEvent } = resolveWorldEventLifecycle(stateAfterDowned, now)
      const { state: stateAfterNarrativeEvent } = resolveEventLifecycle(stateAfterWorldEvent, now)
      const { state: stateAfterUpkeep } = resolveUpkeepDue(stateAfterNarrativeEvent, now)
      const resourcesAfterProduction = applyProductionTick(stateAfterUpkeep, deltaMs)
      const stateAfterProduction = { ...stateAfterUpkeep, resources: resourcesAfterProduction }
      const { disciples, resources } = applyCultivationTick(stateAfterProduction, deltaMs)

      return {
        state: {
          ...stateAfterUpkeep,
          resources,
          disciples,
          simClock: { totalElapsedMs: store.state.simClock.totalElapsedMs + deltaMs },
          worldClock: { totalElapsedMs: store.state.worldClock.totalElapsedMs + deltaMs },
        },
      }
    }),

  foundSect: (provinceId, sectSiteId) =>
    set((store) => {
      // Read-only forever: once founded, this choice can never be re-made (§4.4).
      if (store.state.sectLocation) return {}
      if (!getFoundingEligibility(provinceId, sectSiteId).canFound) return {}

      const now = Date.now()
      const seed = Math.floor(Math.random() * 0x7fffffff)
      const { sectLocation, world } = buildInitialWorldState(provinceId, sectSiteId, seed, now)

      // Apply the site's one-time founding grant, clamped to storage caps like any resource grant (§4.1).
      let resources = store.state.resources
      const startingBonus = getSectSiteDef(sectSiteId).startingBonus
      if (startingBonus) {
        const caps = computeStorageCaps(store.state)
        resources = { ...resources }
        for (const [key, amount] of Object.entries(startingBonus) as [keyof Resources, number][]) {
          resources[key] = Math.min(caps[key], resources[key] + amount)
        }
      }

      const state: GameState = { ...store.state, sectLocation, world, resources }
      saveGame(state)
      return { state }
    }),

  dispatchExpedition: (purpose, locationId, discipleIds, cycleTarget, leaderId) =>
    set((store) => {
      const state = store.state
      if (!state.world) return {}
      if (!getDispatchEligibility(state, locationId, discipleIds, purpose, cycleTarget).canDispatch) return {}

      const now = Date.now()
      const meta = getExpeditionTargetMeta(state, locationId, purpose)
      if (!meta) return {}
      const outboundMs = getTravelTime(state, locationId, purpose)

      // gather runs cycleTarget cycles; every other purpose is a single on-site cycle
      // (a battle, a scan, or a build) — timing comes from getExpeditionTargetMeta.
      const isGather = purpose === 'gather'
      const onSiteMs = meta.onSiteDurationMs
      const effectiveCycleTarget = isGather ? cycleTarget : 1

      // Only a plain (uncontested) outpost build pays a cost up front — seizing an
      // enemy outpost or conquering a seat is paid for in battle, not spirit stones (§4.2).
      let resources = state.resources
      if (purpose === 'claim' && getClaimKind(state, locationId) === 'buildOutpost') {
        const location = getLocation(state, locationId)
        if (location?.kind === 'resource' && location.upgradePath) {
          resources = { ...resources }
          for (const [key, amount] of Object.entries(location.upgradePath.level1.claimCost) as [keyof Resources, number][]) {
            resources[key] -= amount
          }
        }
      }

      // awayUntil is an upper-bound estimate (full order runs to completion); the
      // resolver frees the party at the real arrival, which is never later than this.
      const estimatedAwayMs = outboundMs * 2 + onSiteMs * effectiveCycleTarget

      const expedition: Expedition = {
        id: crypto.randomUUID(),
        purpose,
        targetLocationId: locationId,
        discipleIds,
        phase: 'outbound',
        phaseEndsAt: now + outboundMs,
        dispatchedAt: now,
        outboundMs,
        onSiteMs,
        cycleTarget: effectiveCycleTarget,
        cyclesCompleted: 0,
        payload: emptyPayload(),
        incidents: [],
        leaderId: leaderId && discipleIds.includes(leaderId) ? leaderId : undefined,
      }

      return {
        state: {
          ...state,
          resources,
          world: { ...state.world, expeditions: [...state.world.expeditions, expedition] },
          disciples: state.disciples.map((d) =>
            discipleIds.includes(d.id) ? { ...d, assignedBuildingId: undefined, awayUntil: now + estimatedAwayMs } : d,
          ),
        },
      }
    }),

  garrisonSite: (locationId, discipleIds) =>
    set((store) => {
      const state = store.state
      if (!state.world) return {}
      if (!getGarrisonEligibility(state, locationId, discipleIds).canGarrison) return {}
      return { state: { ...state, world: { ...state.world, locations: garrisonSitePure(state, locationId, discipleIds) } } }
    }),

  ungarrisonSite: (locationId) =>
    set((store) => {
      const state = store.state
      if (!state.world) return {}
      return { state: { ...state, world: { ...state.world, locations: ungarrisonSitePure(state, locationId) } } }
    }),

  setGarrisonReturnWhenWounded: (locationId, value) =>
    set((store) => {
      const state = store.state
      if (!state.world) return {}
      return { state: { ...state, world: { ...state.world, locations: setGarrisonReturnWhenWoundedPure(state, locationId, value) } } }
    }),

  setDefenseLeader: (discipleId) => set((store) => ({ state: { ...store.state, defenseLeaderId: discipleId } })),

  resolveRelocationPrune: (buildingIdsToRemove) =>
    set((store) => {
      const state = store.state
      const pending = state.pendingRelocation
      if (!pending) return {}
      const newCap = getSectSiteDef(pending.newSiteId).buildingSlots
      const remainingCount = Object.keys(state.buildings).length - buildingIdsToRemove.length
      if (remainingCount > newCap) return {} // must remove enough to fit

      const buildings = { ...state.buildings }
      for (const id of buildingIdsToRemove) delete buildings[id]

      return {
        state: {
          ...state,
          buildings,
          pendingRelocation: undefined,
          disciples: state.disciples.map((d) =>
            d.assignedBuildingId && buildingIdsToRemove.includes(d.assignedBuildingId)
              ? { ...d, assignedBuildingId: undefined }
              : d,
          ),
        },
      }
    }),

  recallExpedition: (expeditionId) =>
    set((store) => {
      const world = store.state.world
      if (!world) return {}
      const expeditions = recallExpeditionPure(world.expeditions, expeditionId, Date.now())
      if (expeditions === world.expeditions) return {}
      return { state: { ...store.state, world: { ...world, expeditions } } }
    }),

  discoverProvince: (provinceId) =>
    set((store) => {
      const world = store.state.world
      if (!world || world.provinces[provinceId]?.discovered) return {}
      const generatedNodes = world.generatedNodes[provinceId]
        ? world.generatedNodes
        : { ...world.generatedNodes, [provinceId]: generateProvinceNodes(provinceId, world.seed) }
      return {
        state: {
          ...store.state,
          world: {
            ...world,
            provinces: {
              ...world.provinces,
              [provinceId]: { discovered: true, surveyProgress: world.provinces[provinceId]?.surveyProgress ?? 0 },
            },
            generatedNodes,
          },
        },
      }
    }),

  startUpgrade: (buildingId) =>
    set((store) => {
      const building = store.state.buildings[buildingId]
      if (!building) return {}

      const eligibility = getUpgradeEligibility(store.state, buildingId)
      if (!eligibility.canUpgrade) return {}

      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(eligibility.cost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }

      return {
        state: {
          ...store.state,
          resources,
          buildings: {
            ...store.state.buildings,
            [buildingId]: { ...building, constructionEndsAt: Date.now() + eligibility.durationMs },
          },
        },
      }
    }),

  claimSpecializationSlot: (buildingId) =>
    set((store) => {
      const eligibility = getClaimSlotEligibility(store.state, buildingId)
      if (!eligibility.canClaim) return {}

      const def = getBuildingDef(buildingId)
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(eligibility.cost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }

      return {
        state: {
          ...store.state,
          resources,
          buildings: {
            ...store.state.buildings,
            [buildingId]: {
              id: buildingId,
              category: def.category,
              level: 0,
              constructionEndsAt: Date.now() + eligibility.durationMs,
            },
          },
        },
      }
    }),

  demolishSpecializationBuilding: (buildingId) =>
    set((store) => {
      const eligibility = getDemolishEligibility(store.state, buildingId)
      if (!eligibility.canDemolish) return {}

      const { [buildingId]: _removed, ...buildings } = store.state.buildings

      return {
        state: {
          ...store.state,
          buildings,
          disciples: store.state.disciples.map((d) =>
            d.assignedBuildingId === buildingId ? { ...d, assignedBuildingId: undefined } : d,
          ),
        },
      }
    }),

  saveNow: () =>
    set((store) => {
      saveGame(store.state)
      return { state: { ...store.state, lastSavedAt: Date.now() } }
    }),

  reloadFromSave: () => set(initializeGame()),

  resetSave: () => {
    clearSave()
    const streak = resolveLoginStreak(createNewGame(), Date.now())
    set({
      state: streak.state,
      offlineSummary: streak.streakChanged ? { ...emptyOfflineSummary(), loginStreakBonus: streak.bonus ?? undefined } : null,
    })
  },

  dismissOfflineSummary: () => set({ offlineSummary: null }),

  markReportRead: (id) => set((store) => ({ state: markReportRead(store.state, id) })),
  markAllReportsRead: () => set((store) => ({ state: markAllReportsRead(store.state) })),

  debugAddResources: () =>
    set((store) => {
      const caps = computeStorageCaps(store.state)
      const resources = { ...store.state.resources }
      for (const key of Object.keys(resources) as (keyof Resources)[]) {
        resources[key] = Math.min(caps[key], resources[key] + DEBUG_RESOURCE_GRANT[key])
      }
      return { state: { ...store.state, resources } }
    }),

  // Crafting Recipe Pack Phase 3: the only source of materials until a real acquisition pass exists (§10).
  debugAddMaterials: () =>
    set((store) => {
      const materials = { ...store.state.materials }
      for (const def of MATERIAL_DEFS) {
        materials[def.id] = (materials[def.id] ?? 0) + DEBUG_MATERIAL_GRANT
      }
      return { state: { ...store.state, materials } }
    }),

  debugDamageSectHall: () =>
    set((store) => {
      const hall = store.state.buildings[SECT_HALL_ID]
      if (!hall) return {}
      // Mirrors doc 02 Section 8: destruction drops 2 levels, floored at 1.
      const newLevel = Math.max(1, hall.level - 2)
      return {
        state: {
          ...store.state,
          buildings: { ...store.state.buildings, [SECT_HALL_ID]: { ...hall, level: newLevel } },
        },
      }
    }),

  recruitDisciple: () =>
    set((store) => {
      const capacity = computeDiscipleCapacity(store.state.buildings)
      if (store.state.disciples.length >= capacity) return {}

      const cost = getEffectiveRecruitmentCost(store.state)
      if (store.state.resources.spiritStones < cost) return {}

      return {
        state: {
          ...store.state,
          resources: { ...store.state.resources, spiritStones: store.state.resources.spiritStones - cost },
          // Province Spirit Vein raises recruit quality (§7.1).
          disciples: [...store.state.disciples, createRecruit(getSectSpiritVein(store.state).recruitQualityMult)],
        },
      }
    }),

  expelDisciple: (discipleId) =>
    set((store) => {
      const nextState = expelDisciple(store.state, discipleId)
      if (nextState === store.state) return {}
      saveGame(nextState)
      return { state: nextState }
    }),

  assignDisciple: (discipleId, buildingId) =>
    set((store) => {
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      // Presence Requirement: an away disciple cannot be reassigned (doc 03, Section 8).
      if (!disciple || disciple.awayUntil !== undefined) return {}
      // Unassigning (undefined) is always allowed; assigning re-validates the work-slot cap.
      if (buildingId !== undefined && !getAssignEligibility(store.state, discipleId, buildingId).canAssign) return {}

      return {
        state: {
          ...store.state,
          disciples: store.state.disciples.map((d) =>
            d.id === discipleId ? { ...d, assignedBuildingId: buildingId } : d,
          ),
        },
      }
    }),

  activateCultivationBoost: (discipleId) =>
    set((store) => {
      const eligibility = getBoostEligibility(store.state, discipleId)
      if (!eligibility.canActivate) return {}

      const now = Date.now()
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(BOOST_COST) as [keyof Resources, number][]) {
        resources[key] -= amount
      }

      return {
        state: {
          ...store.state,
          resources,
          qiStoneProductionPenaltyUntil: Math.max(
            store.state.qiStoneProductionPenaltyUntil ?? 0,
            now + BOOST_DURATION_MS,
          ),
          disciples: store.state.disciples.map((d) =>
            d.id === discipleId ? { ...d, activeBoostUntil: now + BOOST_DURATION_MS } : d,
          ),
        },
      }
    }),

  attemptBreakthrough: (discipleId) =>
    set((store) => {
      if (!getBreakthroughEligibility(store.state, discipleId).canBreakthrough) return {}
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      if (!disciple) return {}

      const result = resolveBreakthrough(disciple, store.state.resources)
      const withResult: GameState = {
        ...store.state,
        resources: result.resources,
        disciples: store.state.disciples.map((d) => (d.id === discipleId ? result.disciple : d)),
      }
      // A failed breakthrough can wound the disciple to 0 HP — cultivating while hurt is genuinely dangerous (Phase 5).
      const { state: nextState } = resolveDownedDisciples(withResult, Date.now(), Date.now() >>> 0)
      saveGame(nextState)
      return { state: nextState }
    }),

  attemptBreakthroughAll: () =>
    set((store) => {
      // All-or-nothing: only run when every ready disciple's breakthrough is affordable.
      if (!getBreakthroughAllSummary(store.state).canAffordAll) return {}

      const result = resolveBreakthroughAll(store.state)
      const withResult: GameState = {
        ...store.state,
        resources: result.resources,
        disciples: result.disciples,
        eventLog: result.logEntry ? [result.logEntry, ...store.state.eventLog].slice(0, 10) : store.state.eventLog,
      }
      // Batch breakthroughs can wound several disciples to 0 at once (Phase 5).
      const { state: nextState } = resolveDownedDisciples(withResult, Date.now(), Date.now() >>> 0)
      saveGame(nextState)
      return { state: nextState }
    }),

  dispatchMission: (offerId, squadDiscipleIds) =>
    set((store) => {
      const offer = store.state.missionBoard.offers.find((o) => o.id === offerId)
      const eligibility = getMissionDispatchEligibility(store.state, offer, squadDiscipleIds)
      if (!offer || !eligibility.canDispatch) return {}

      const now = Date.now()
      const def = getMissionDef(offer.defId)
      const endsAt = now + def.durationMs

      return {
        state: {
          ...store.state,
          missionBoard: {
            ...store.state.missionBoard,
            offers: store.state.missionBoard.offers.filter((o) => o.id !== offerId),
          },
          activeMissions: [
            ...store.state.activeMissions,
            { id: crypto.randomUUID(), defId: def.id, squadDiscipleIds, startedAt: now, endsAt },
          ],
          disciples: store.state.disciples.map((d) =>
            squadDiscipleIds.includes(d.id) ? { ...d, assignedBuildingId: undefined, awayUntil: endsAt } : d,
          ),
        },
      }
    }),

  startCraft: (recipeId, quantity = 1) =>
    set((store) => {
      const batch = Math.max(1, Math.floor(quantity))
      const eligibility = getCraftEligibility(store.state, recipeId, batch)
      if (!eligibility.canCraft) return {}

      const recipe = getRecipe(recipeId)
      // The whole batch is paid upfront (see getCraftEligibility), then produced
      // one item per itemDurationMs by resolveCompletedCrafting.
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(recipe.cost) as [keyof Resources, number][]) {
        resources[key] -= amount * batch
      }
      const materials = { ...store.state.materials }
      for (const [key, amount] of Object.entries(recipe.materialCost ?? {})) {
        materials[key] = (materials[key] ?? 0) - amount * batch
      }
      const itemDurationMs = recipe.durationMs * getResearchCraftingDurationMultiplier(store.state, recipe.discipline)
      // §6a — capture the crafter now (at batch start), if a disciple is assigned to the recipe's building. Stamped onto every piece the batch produces; a mid-craft reassignment won't rewrite it.
      const craftedBy = store.state.disciples.find((d) => d.assignedBuildingId === recipe.requiredBuildingId)?.name

      return {
        state: {
          ...store.state,
          resources,
          materials,
          craftingQueue: { recipeId, endsAt: Date.now() + itemDurationMs, remaining: batch, itemDurationMs, craftedBy },
        },
      }
    }),

  equipItem: (discipleId, instanceId) =>
    set((store) => {
      const eligibility = getEquipEligibility(store.state, discipleId, instanceId)
      if (!eligibility.canEquip || !eligibility.targetSlot) return {}
      const slot = eligibility.targetSlot
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      if (!disciple) return {}
      const found = store.state.items.find((i) => i.id === instanceId)
      if (!found) return {}
      // §6c — stamp the first disciple to ever wear this piece; never overwritten on later swaps.
      const instance = found.firstWielder ? found : { ...found, firstWielder: disciple.name }
      const previous = disciple.equipment[slot]

      let items = removeInstanceById(store.state.items, instanceId)
      if (previous !== undefined) {
        items = addExistingInstance(items, previous)
      }

      return {
        state: {
          ...store.state,
          items,
          disciples: store.state.disciples.map((d) =>
            d.id === discipleId ? { ...d, equipment: { ...d.equipment, [slot]: instance } } : d,
          ),
        },
      }
    }),

  unequipItem: (discipleId, slot) =>
    set((store) => {
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      const instance = disciple?.equipment[slot]
      if (!disciple || instance === undefined) return {}

      return {
        state: {
          ...store.state,
          items: addExistingInstance(store.state.items, instance),
          disciples: store.state.disciples.map((d) =>
            d.id === discipleId ? { ...d, equipment: { ...d.equipment, [slot]: undefined } } : d,
          ),
        },
      }
    }),

  useConsumable: (discipleId, itemDefId) =>
    set((store) => {
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      const stack = store.state.items.find((i) => i.itemId === itemDefId)
      if (!disciple || !stack || stack.quantity <= 0) return {}

      const def = getItemDef(itemDefId)
      if (def.category !== 'Pill') return {}

      let updatedDisciple: typeof disciple
      if (def.pillEffect === 'heal') {
        // Heal a set amount, overheal clamped to max HP (HEALTH_SYSTEM_PLAN Phase 3). Refused only at exactly full HP —
        // any missing HP is healable, even a disciple whose band still reads 'none'.
        const maxHp = getEffectiveMaxHp(disciple)
        if (disciple.health >= maxHp) return {}
        updatedDisciple = { ...disciple, health: Math.min(maxHp, disciple.health + (def.healAmount ?? 0)) }
      } else if (def.pillEffect === 'cultivate') {
        const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
        if (realmIndex === CULTIVATION_REALMS.length - 1) return {}
        updatedDisciple = {
          ...disciple,
          cultivationProgress: Math.min(100, disciple.cultivationProgress + (def.cultivateAmount ?? 0)),
        }
      } else {
        return {}
      }

      return {
        state: {
          ...store.state,
          items: removeItemFromInventory(store.state.items, itemDefId),
          disciples: store.state.disciples.map((d) => (d.id === discipleId ? updatedDisciple : d)),
        },
      }
    }),

  debugSimulateOfflineGap: (hours) =>
    set((store) => {
      // Rewinds every pending timestamp (not just the save time), so the
      // same offline catch-up path a real reload uses can be exercised
      // without actually waiting or closing the tab.
      const rewound = rewindStateClock(store.state, hours * 60 * 60 * 1000)
      const { state, summary } = applyOfflineCatchUp(rewound)
      saveGame(state)
      return { state, offlineSummary: summary }
    }),

  startResearch: (projectId) =>
    set((store) => {
      const eligibility = getResearchEligibility(store.state, projectId)
      if (!eligibility.canResearch) return {}

      const def = getResearchProjectDef(projectId)
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(def.cost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }

      return {
        state: {
          ...store.state,
          resources,
          researchQueue: { projectId, endsAt: Date.now() + getResearchDurationMs(store.state, projectId) },
        },
      }
    }),

  teachTechnique: (discipleId, techniqueId) =>
    set((store) => {
      const eligibility = getTeachEligibility(store.state, discipleId, techniqueId)
      if (!eligibility.canTeach) return {}

      const def = getTechniqueDef(techniqueId)
      const now = Date.now()
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(def.teachCost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }
      const items = def.requiredItemDefId
        ? removeItemFromInventory(store.state.items, def.requiredItemDefId)
        : store.state.items

      return {
        state: {
          ...store.state,
          resources,
          items,
          disciples: store.state.disciples.map((d) =>
            d.id === discipleId
              ? { ...d, learningTechniqueId: techniqueId, learningTechniqueUntil: now + def.teachDurationMs }
              : d,
          ),
        },
      }
    }),

  chooseDoctrine: (doctrineId) =>
    set((store) => {
      // Permanent, one-time choice (doc 10 §11) — Doctrine Evolution is out of MVP scope.
      if (store.state.doctrine !== undefined) return {}
      return { state: { ...store.state, doctrine: doctrineId } }
    }),

  performDiplomaticAction: (factionId, actionId) =>
    set((store) => {
      const next = applyDiplomaticAction(store.state, factionId, actionId, Date.now())
      return next === store.state ? {} : { state: next }
    }),

  resolveEventChoice: (choiceIndex) =>
    set((store) => ({ state: applyEventChoice(store.state, choiceIndex, Date.now()) })),

  debugForceWorldEvent: () => set((store) => ({ state: { ...store.state, nextWorldEventAt: Date.now() } })),

  debugForceEvent: () => set((store) => ({ state: { ...store.state, nextEventAt: Date.now() } })),
}))
