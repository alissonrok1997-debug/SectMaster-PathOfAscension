import type { GameState } from '../types'
import { SECT_HALL_ID } from '../data/buildingDefs'

/** Work slots a building offers for disciple assignment: floor(level / 2) + 1. */
export function getBuildingSlotCount(level: number): number {
  return Math.floor(level / 2) + 1
}

export function getAssignedDiscipleCount(state: GameState, buildingId: string): number {
  return state.disciples.filter((d) => d.assignedBuildingId === buildingId).length
}

export interface AssignEligibility {
  canAssign: boolean
  reason?: string
}

/**
 * Single source of truth for whether a disciple can take a work slot at a building —
 * mirrors the codebase's eligibility-function pattern (used by both the UI and the store guard).
 * Re-assigning to the building a disciple already occupies is a no-op that stays allowed.
 */
export function getAssignEligibility(state: GameState, discipleId: string, buildingId: string): AssignEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { canAssign: false, reason: 'Disciple not found.' }
  // Presence Requirement: an away disciple cannot be reassigned (doc 03, Section 8).
  if (disciple.awayUntil !== undefined) return { canAssign: false, reason: 'Away on a mission.' }
  const building = state.buildings[buildingId]
  if (!building) return { canAssign: false, reason: 'Building not built.' }
  if (buildingId === SECT_HALL_ID) return { canAssign: false, reason: 'The Sect Hall has no work assignments.' }
  if (disciple.assignedBuildingId === buildingId) return { canAssign: true }

  const slotCount = getBuildingSlotCount(building.level)
  if (getAssignedDiscipleCount(state, buildingId) >= slotCount) {
    return { canAssign: false, reason: `All ${slotCount} work slot${slotCount === 1 ? '' : 's'} are full.` }
  }
  return { canAssign: true }
}
