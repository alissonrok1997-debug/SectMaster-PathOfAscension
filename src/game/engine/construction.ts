import type { BuildingInstance } from '../types'

/**
 * Resolves any building whose upgrade timer has elapsed. The single
 * construction queue (doc 02, Section 7) is enforced at start-time in the
 * store, not here — this just completes whichever one is running.
 */
export function resolveCompletedConstruction(
  buildings: Record<string, BuildingInstance>,
  now: number,
): Record<string, BuildingInstance> {
  let changed = false
  const next = { ...buildings }

  for (const [id, building] of Object.entries(buildings)) {
    if (building.constructionEndsAt !== undefined && building.constructionEndsAt <= now) {
      next[id] = { ...building, level: building.level + 1, constructionEndsAt: undefined }
      changed = true
    }
  }

  return changed ? next : buildings
}

export function isConstructionQueueBusy(buildings: Record<string, BuildingInstance>): boolean {
  return Object.values(buildings).some((b) => b.constructionEndsAt !== undefined)
}
