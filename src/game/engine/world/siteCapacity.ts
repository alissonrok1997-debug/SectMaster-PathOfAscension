import type { GameState } from '../../types'
import { getSectSiteDef } from '../../data/world/sectSiteDefs'

/**
 * The founded sect site's building-slot cap (WORLD_MAP_DESIGN §4.3). Derived, not
 * enforced by data shape: `used` is simply how many buildings currently exist in
 * `state.buildings` (core + claimed specializations), `total` is the site's cap.
 * Feeds the 'noBuildingSlots' construction eligibility reason. No cap pre-founding
 * (Infinity), where no building can be claimed anyway.
 */
export interface BuildingSlotUsage {
  used: number
  total: number
}

export function getBuildingSlotUsage(state: GameState): BuildingSlotUsage {
  const used = Object.keys(state.buildings).length
  const total = state.sectLocation ? getSectSiteDef(state.sectLocation.sectSiteId).buildingSlots : Infinity
  return { used, total }
}
