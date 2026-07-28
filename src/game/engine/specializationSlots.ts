import type { GameState, Resources } from '../types'
import {
  getBuildingDef,
  getSpecializationBuildingDefs,
  getUpgradeCost,
  getUpgradeDurationMs,
  SPECIALIZATION_SLOT_COUNT,
  type BuildingDefinition,
} from '../data/buildingDefs'
import { isConstructionQueueBusy } from './construction'

export function getClaimedSpecializationCount(state: GameState): number {
  return Object.keys(state.buildings).filter((id) => getBuildingDef(id).slotType === 'specialization').length
}

/** Specialization defs not currently occupying one of the 6 slots — the pool a player can pick from. */
export function getAvailableSpecializationDefs(state: GameState): BuildingDefinition[] {
  return getSpecializationBuildingDefs().filter((def) => state.buildings[def.id] === undefined)
}

export interface ClaimSlotEligibility {
  canClaim: boolean
  reason?: string
  cost: Partial<Resources>
  durationMs: number
}

/**
 * Single source of truth for whether a specialization building can be claimed into a slot —
 * mirrors getUpgradeEligibility's shape/role (used by both the picker UI and the store guard).
 * Claiming reuses the existing single construction queue: it's a level 0 -> 1 build at the
 * def's baseCost/baseDurationMs, exactly like a building's first real upgrade already costs.
 */
export function getClaimSlotEligibility(state: GameState, buildingId: string): ClaimSlotEligibility {
  const def = getBuildingDef(buildingId)
  const cost = getUpgradeCost(def, 1)
  const durationMs = getUpgradeDurationMs(def, 1)

  const fail = (reason: string): ClaimSlotEligibility => ({ canClaim: false, reason, cost, durationMs })

  if (def.slotType !== 'specialization') {
    return fail('Not a specialization building.')
  }
  if (state.buildings[buildingId] !== undefined) {
    return fail('Already claimed.')
  }
  if (isConstructionQueueBusy(state.buildings)) {
    return fail('Construction queue is busy — only one upgrade can run at a time.')
  }
  if (getClaimedSpecializationCount(state) >= SPECIALIZATION_SLOT_COUNT) {
    return fail(`All ${SPECIALIZATION_SLOT_COUNT} specialization slots are occupied.`)
  }
  for (const [key, amount] of Object.entries(cost) as [keyof Resources, number][]) {
    if (state.resources[key] < amount) {
      return fail('Not enough resources.')
    }
  }

  return { canClaim: true, cost, durationMs }
}

export interface DemolishEligibility {
  canDemolish: boolean
  reason?: string
}

/** Demolishing is instant, free, and gives no refund — it only ever frees the slot back up. */
export function getDemolishEligibility(state: GameState, buildingId: string): DemolishEligibility {
  const def = getBuildingDef(buildingId)
  if (def.slotType !== 'specialization') {
    return { canDemolish: false, reason: 'Core buildings cannot be demolished.' }
  }
  if (state.buildings[buildingId] === undefined) {
    return { canDemolish: false, reason: 'Not currently built.' }
  }
  return { canDemolish: true }
}
