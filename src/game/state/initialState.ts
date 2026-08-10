import { createInitialGameState, type BuildingInstance, type GameState } from '../types'
import { getCoreBuildingDefs } from '../data/buildingDefs'
import { getRefreshedMissionBoard } from '../engine/missions'
import { UPKEEP_INTERVAL_MS } from '../engine/upkeep'
import { FACTION_DEFS } from '../data/factionDefs'

/** Wave 1 starting stockpile — enough to test the first Sect Hall upgrade without a long wait. */
const STARTING_RESOURCES = {
  spiritStones: 200,
  spiritWood: 60,
  ironEssence: 30,
}

/** Dev-scale delay before the first world/narrative event roll, so a fresh sect has a moment to get its footing. */
const FIRST_WORLD_EVENT_DELAY_MS = 90_000
const FIRST_NARRATIVE_EVENT_DELAY_MS = 60_000

export function createNewGame(): GameState {
  const base = createInitialGameState()
  const now = Date.now()

  const buildings: Record<string, BuildingInstance> = {}
  for (const def of getCoreBuildingDefs()) {
    buildings[def.id] = { id: def.id, category: def.category, level: 1 }
  }

  const factionRelationships: Record<string, number> = {}
  for (const faction of FACTION_DEFS) {
    factionRelationships[faction.id] = 0
  }

  return {
    ...base,
    resources: { ...base.resources, ...STARTING_RESOURCES },
    buildings,
    missionBoard: getRefreshedMissionBoard(now),
    factionRelationships,
    nextWorldEventAt: now + FIRST_WORLD_EVENT_DELAY_MS,
    nextEventAt: now + FIRST_NARRATIVE_EVENT_DELAY_MS,
    nextUpkeepAt: now + UPKEEP_INTERVAL_MS,
  }
}
