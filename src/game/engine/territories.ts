import type { GameState, Resources } from '../types'
import { TERRITORY_DEFS, getTerritoryDef } from '../data/territoryDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'

export interface TerritoryClaimEligibility {
  canClaim: boolean
  reason?: string
}

/** Single source of truth for whether a territory can be claimed — shared by the World Panel and the store guard, same pattern as getResearchEligibility. */
export function getTerritoryClaimEligibility(state: GameState, territoryId: string): TerritoryClaimEligibility {
  const def = getTerritoryDef(territoryId)

  if (state.ownedTerritories.includes(territoryId)) {
    return { canClaim: false, reason: 'Already owned.' }
  }
  if (state.territoryClaimQueue !== undefined) {
    return { canClaim: false, reason: 'Territory claim queue is busy — only one claim at a time.' }
  }
  if (state.reputation < def.requiredReputation) {
    return { canClaim: false, reason: `Requires ${def.requiredReputation} reputation.` }
  }
  const deficits = (Object.entries(def.claimCost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
  if (deficits.length > 0) {
    return { canClaim: false, reason: `Need ${deficits.join(', ')}.` }
  }

  return { canClaim: true }
}

/**
 * Resolves an in-progress territory claim once its timer elapses, adding it
 * to the permanent `ownedTerritories` list. Single-slot sweep — same "sweep
 * whatever's due" shape as resolveCompletedCrafting/resolveCompletedResearch.
 */
export function resolveCompletedTerritoryClaim(
  state: GameState,
  now: number,
): { state: GameState; territoryClaimed?: string } {
  const queue = state.territoryClaimQueue
  if (queue === undefined || queue.endsAt > now) return { state }

  return {
    state: {
      ...state,
      ownedTerritories: [...state.ownedTerritories, queue.territoryId],
      territoryClaimQueue: undefined,
    },
    territoryClaimed: queue.territoryId,
  }
}

/** Production multiplier for one resource from every owned territory whose bonus targets it — pure lookup, same shape as getResearchStorageCapMultiplier, no duplicated state. */
export function getTerritoryProductionBonus(state: GameState, resourceKey: keyof Resources): number {
  return TERRITORY_DEFS.filter(
    (t) => t.productionBonus.resourceKey === resourceKey && state.ownedTerritories.includes(t.id),
  ).reduce((mult, t) => mult * (1 + t.productionBonus.multiplier), 1)
}
