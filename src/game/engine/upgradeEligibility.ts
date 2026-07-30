import type { GameState, Resources } from '../types'
import { getBuildingDef, getUpgradeCost, getUpgradeDurationMs, SECT_HALL_ID } from '../data/buildingDefs'
import { computeSectRank } from './sectRank'
import { isConstructionQueueBusy } from './construction'
import { getWorldModifiers } from './world/worldModifiers'

export interface UpgradeEligibility {
  canUpgrade: boolean
  reason?: string
  cost: Partial<Resources>
  durationMs: number
  targetLevel: number
}

/**
 * Single source of truth for whether a building can start upgrading —
 * used both to render the Upgrade button/tooltip and to validate the
 * store action before it mutates state.
 */
export function getUpgradeEligibility(state: GameState, buildingId: string): UpgradeEligibility {
  const building = state.buildings[buildingId]
  const def = getBuildingDef(buildingId)

  if (!building) {
    return { canUpgrade: false, reason: 'Not yet built.', cost: {}, durationMs: 0, targetLevel: 1 }
  }

  const targetLevel = building.level + 1
  const cost = getUpgradeCost(def, building.level)
  // Sect-site build-time modifier (§4.2, e.g. Cinder Terrace -15%). Snapshotted at start like every duration here.
  const durationMs = getUpgradeDurationMs(def, building.level) * getWorldModifiers(state).buildTimeMult
  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  const rank = computeSectRank(hallLevel)
  const isHall = buildingId === SECT_HALL_ID

  const fail = (reason: string): UpgradeEligibility => ({
    canUpgrade: false,
    reason,
    cost,
    durationMs,
    targetLevel,
  })

  if (isConstructionQueueBusy(state.buildings)) {
    return fail('Construction queue is busy — only one upgrade can run at a time.')
  }
  if (targetLevel > rank.levelCap) {
    return fail(`${rank.name} rank caps building levels at ${rank.levelCap}.`)
  }
  if (!isHall && targetLevel > hallLevel) {
    return fail(`Cannot exceed the Sect Hall's level (${hallLevel}). Upgrade the Sect Hall first.`)
  }
  for (const [key, amount] of Object.entries(cost) as [keyof Resources, number][]) {
    if (state.resources[key] < amount) {
      return fail('Not enough resources.')
    }
  }

  return { canUpgrade: true, cost, durationMs, targetLevel }
}
