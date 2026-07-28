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
import { resolveCompletedConstruction } from '../engine/construction'
import { getUpgradeEligibility } from '../engine/upgradeEligibility'
import { getClaimSlotEligibility, getDemolishEligibility } from '../engine/specializationSlots'
import { computeStorageCaps } from '../engine/storage'
import { getBuildingDef, SECT_HALL_ID } from '../data/buildingDefs'
import { applyCultivationTick } from '../engine/cultivation'
import { computeDiscipleCapacity } from '../engine/discipleCapacity'
import { createRecruit, getRecruitmentCost } from '../engine/recruitment'
import { BOOST_COST, BOOST_DURATION_MS, getBoostEligibility } from '../engine/cultivationBoost'
import { applyOfflineCatchUp, emptyOfflineSummary, rewindStateClock, type OfflineSummary } from '../engine/offlineCatchup'
import { resolveLoginStreak } from '../engine/loginStreak'
import { getMissionDispatchEligibility, resolveCompletedMissions, resolveMissionBoardRefresh } from '../engine/missions'
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
import {
  getResearchDurationMs,
  getResearchCraftingDurationMultiplier,
  getResearchEligibility,
  resolveCompletedResearch,
} from '../engine/research'
import { getResearchProjectDef } from '../data/researchProjectDefs'
import { getTeachEligibility, resolveCompletedTeaching } from '../engine/techniques'
import { getTechniqueDef } from '../data/techniqueDefs'
import { getTerritoryClaimEligibility, resolveCompletedTerritoryClaim } from '../engine/territories'
import { getTerritoryDef } from '../data/territoryDefs'
import { applyDiplomaticAction } from '../engine/diplomacy'
import { resolveWorldEventLifecycle } from '../engine/worldEvents'
import { resolveEventChoice as applyEventChoice, resolveEventLifecycle } from '../engine/events'

const DEBUG_RESOURCE_GRANT: Resources = {
  spiritStones: 200,
  qiStone: 200,
  spiritWood: 200,
  ironEssence: 200,
  spiritHerb: 200,
  knowledge: 200,
}

interface GameStore {
  state: GameState
  offlineSummary: OfflineSummary | null
  dismissOfflineSummary: () => void
  /** Advances both clocks by real elapsed ms, applies production/cultivation, resolves finished construction. */
  tick: (deltaMs: number) => void
  startUpgrade: (buildingId: string) => void
  claimSpecializationSlot: (buildingId: string) => void
  demolishSpecializationBuilding: (buildingId: string) => void
  recruitDisciple: () => void
  assignDisciple: (discipleId: string, buildingId: string | undefined) => void
  activateCultivationBoost: (discipleId: string) => void
  dispatchMission: (offerId: string, squadDiscipleIds: string[]) => void
  startCraft: (recipeId: string) => void
  equipItem: (discipleId: string, instanceId: string) => void
  unequipItem: (discipleId: string, slot: EquipmentSlotId) => void
  useConsumable: (discipleId: string, itemDefId: string) => void
  startResearch: (projectId: string) => void
  teachTechnique: (discipleId: string, techniqueId: string) => void
  chooseDoctrine: (doctrineId: SectDoctrineId) => void
  claimTerritory: (territoryId: string) => void
  performDiplomaticAction: (factionId: string, actionId: DiplomaticActionId) => void
  resolveEventChoice: (choiceIndex: number) => void
  saveNow: () => void
  reloadFromSave: () => void
  resetSave: () => void
  debugAddResources: () => void
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
      const now = Date.now()
      const buildings = resolveCompletedConstruction(store.state.buildings, now)
      const stateAfterConstruction = { ...store.state, buildings }
      const { state: stateAfterCrafting } = resolveCompletedCrafting(stateAfterConstruction, now)
      const { state: stateAfterResearch } = resolveCompletedResearch(stateAfterCrafting, now)
      const { disciples: disciplesAfterTeaching } = resolveCompletedTeaching(stateAfterResearch.disciples, now)
      const stateAfterTeaching = { ...stateAfterResearch, disciples: disciplesAfterTeaching }
      const stateAfterMissionBoard = resolveMissionBoardRefresh(stateAfterTeaching, now)
      const { state: stateAfterMissions } = resolveCompletedMissions(stateAfterMissionBoard, now)
      const { state: stateAfterTerritory } = resolveCompletedTerritoryClaim(stateAfterMissions, now)
      const { state: stateAfterWorldEvent } = resolveWorldEventLifecycle(stateAfterTerritory, now)
      const { state: stateAfterNarrativeEvent } = resolveEventLifecycle(stateAfterWorldEvent, now)
      const resourcesAfterProduction = applyProductionTick(stateAfterNarrativeEvent, deltaMs)
      const stateAfterProduction = { ...stateAfterNarrativeEvent, resources: resourcesAfterProduction }
      const { disciples, resources } = applyCultivationTick(stateAfterProduction, deltaMs)

      return {
        state: {
          ...stateAfterProduction,
          resources,
          disciples,
          simClock: { totalElapsedMs: store.state.simClock.totalElapsedMs + deltaMs },
          worldClock: { totalElapsedMs: store.state.worldClock.totalElapsedMs + deltaMs },
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

  debugAddResources: () =>
    set((store) => {
      const caps = computeStorageCaps(store.state)
      const resources = { ...store.state.resources }
      for (const key of Object.keys(resources) as (keyof Resources)[]) {
        resources[key] = Math.min(caps[key], resources[key] + DEBUG_RESOURCE_GRANT[key])
      }
      return { state: { ...store.state, resources } }
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

      const cost = getRecruitmentCost(store.state.disciples.length)
      if (store.state.resources.spiritStones < cost) return {}

      return {
        state: {
          ...store.state,
          resources: { ...store.state.resources, spiritStones: store.state.resources.spiritStones - cost },
          disciples: [...store.state.disciples, createRecruit()],
        },
      }
    }),

  assignDisciple: (discipleId, buildingId) =>
    set((store) => {
      const disciple = store.state.disciples.find((d) => d.id === discipleId)
      // Presence Requirement: an away disciple cannot be reassigned (doc 03, Section 8).
      if (!disciple || disciple.awayUntil !== undefined) return {}
      if (buildingId !== undefined && !store.state.buildings[buildingId]) return {}

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

  startCraft: (recipeId) =>
    set((store) => {
      const eligibility = getCraftEligibility(store.state, recipeId)
      if (!eligibility.canCraft) return {}

      const recipe = getRecipe(recipeId)
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(recipe.cost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }
      const durationMs = recipe.durationMs * getResearchCraftingDurationMultiplier(store.state, recipe.discipline)

      return {
        state: {
          ...store.state,
          resources,
          craftingQueue: { recipeId, endsAt: Date.now() + durationMs },
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
      const instance = store.state.items.find((i) => i.id === instanceId)
      if (!instance) return {}
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
        if (disciple.injury === 'none') return {}
        updatedDisciple = { ...disciple, injury: 'none', injuryRecoversAt: undefined }
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

  claimTerritory: (territoryId) =>
    set((store) => {
      const eligibility = getTerritoryClaimEligibility(store.state, territoryId)
      if (!eligibility.canClaim) return {}

      const def = getTerritoryDef(territoryId)
      const resources = { ...store.state.resources }
      for (const [key, amount] of Object.entries(def.claimCost) as [keyof Resources, number][]) {
        resources[key] -= amount
      }

      return {
        state: {
          ...store.state,
          resources,
          territoryClaimQueue: { territoryId, endsAt: Date.now() + def.claimDurationMs },
        },
      }
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
