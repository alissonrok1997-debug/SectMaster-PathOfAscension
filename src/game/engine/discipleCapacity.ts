import type { BuildingInstance } from '../types'

/** Disciple capacity (doc 03, Section 7). MVP scopes this to Dormitory level only — Sect Rank and Treasury upkeep gates are deferred until those systems matter more. */
export function computeDiscipleCapacity(buildings: Record<string, BuildingInstance>): number {
  const dormitoryLevel = buildings.dormitory?.level ?? 0
  return 2 + dormitoryLevel * 2
}
