import type {
  GeneratedNodeRecord,
  ProvinceId,
  ProvinceRuntime,
  SectLocation,
  SectSiteId,
  WorldState,
} from '../../types'
import { WORLD_DEF } from '../../data/world/worldDef'
import { getProvinceDef, type ProvinceDefinition } from '../../data/world/provinceDefs'
import { getSectSitesForProvince, type SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { getNeighbours } from '../../data/world/worldGraph'
import { generateProvinceNodes } from './worldGeneration'

/**
 * The pre-game founding decision (WORLD_MAP_DESIGN §12.2). Eligibility is a pure
 * function shared by the FoundingScreen (to gate the Confirm button) and the
 * store action (to re-validate before mutating), same pattern as every other
 * gated action. `buildInitialWorldState` is the seed-in / world-out step the
 * store commits once, irreversibly.
 */

export interface FoundingProvinceOption {
  province: ProvinceDefinition
  sites: SectSiteDefinition[]
}

/** The provinces selectable at founding (§1.1) — the starter subset, each with its sites. */
export function getFoundingOptions(): FoundingProvinceOption[] {
  return WORLD_DEF.foundingProvinceIds.map((id) => ({
    province: getProvinceDef(id),
    sites: getSectSitesForProvince(id),
  }))
}

export interface FoundingEligibility {
  canFound: boolean
  reason?: string
}

export function getFoundingEligibility(provinceId: ProvinceId, sectSiteId: SectSiteId): FoundingEligibility {
  if (!WORLD_DEF.foundingProvinceIds.includes(provinceId)) {
    return { canFound: false, reason: 'This province cannot be chosen at founding.' }
  }
  const sites = getSectSitesForProvince(provinceId)
  if (!sites.some((s) => s.id === sectSiteId)) {
    return { canFound: false, reason: 'That site is not in the chosen province.' }
  }
  return { canFound: true }
}

/**
 * Builds the founding province's world state from a seed. Generates minor nodes
 * for the founding province and its neighbours (for map preview, §5.4) but marks
 * only the founding province `discovered` — ProvinceRuntime stays sparse (§2.2),
 * so neighbours have generated nodes without a runtime entry until visited.
 */
export function buildInitialWorldState(
  provinceId: ProvinceId,
  sectSiteId: SectSiteId,
  seed: number,
  now: number,
): { sectLocation: SectLocation; world: WorldState } {
  const provinces: Record<ProvinceId, ProvinceRuntime> = {
    [provinceId]: { discovered: true, surveyProgress: 0 },
  }

  const generatedNodes: Record<ProvinceId, GeneratedNodeRecord[]> = {}
  for (const pid of [provinceId, ...getNeighbours(provinceId)]) {
    generatedNodes[pid] = generateProvinceNodes(pid, seed)
  }

  const world: WorldState = {
    seed,
    provinces,
    locations: {},
    generatedNodes,
    expeditions: [],
    expeditionLog: [],
  }

  return { sectLocation: { provinceId, sectSiteId, foundedAt: now }, world }
}
