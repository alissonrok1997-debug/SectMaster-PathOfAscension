import type { GameState, ProvinceId, Resources, SectId } from '../../types'
import { RESOURCE_LABELS } from '../../data/resourceLabels'
import { getVisibleLocations, type ResolvedLocation } from './worldQueries'
import { getTravelTime } from './travel'

/**
 * Pure filtering + ordering for the province node list (NODE_FILTER_SORT_PLAN).
 * Owns the filter shape, its defaults, the yield-per-hour metric, and the single
 * `browseNodes` entry point the component calls in place of its old inline
 * `.filter().sort()`. Reuses `getVisibleLocations`, `getTravelTime`, and
 * `RESOURCE_LABELS`; introduces no new data and no persisted field — nothing here
 * touches `GameState` beyond reading it.
 */

export type NodeOwnership = 'all' | 'mine' | 'unclaimed' | 'rival'
export type NodeSort = 'nearest' | 'richest' | 'safest' | 'mine' | 'name'

export interface NodeBrowseFilter {
  ownership: NodeOwnership
  hideDepleted: boolean
  /** Narrow to gatherable nodes yielding this resource; null = any. */
  resource: keyof Resources | null
  sort: NodeSort
  /** Prop-driven hard scope (the seat's own territory, Wave 3); undefined = whole province. */
  territoryId?: string
}

/** Fresh defaults — nearest-first, depleted hidden, no resource narrowing. Reset on every visit. */
export function createNodeBrowseFilter(territoryId?: string): NodeBrowseFilter {
  return { ownership: 'all', hideDepleted: true, resource: null, sort: 'nearest', territoryId }
}

const MS_PER_HOUR = 3_600_000

function sumYield(yieldPerVisit: Partial<Resources>): number {
  let total = 0
  for (const v of Object.values(yieldPerVisit)) total += v ?? 0
  return total
}

/**
 * Yield per hour of round trip (§4.1) — the payload normalised over travel there
 * and back plus on-site time, so the ordering can never contradict the round-trip
 * number the card already shows. `resource` picks the filtered resource's amount
 * when set, the summed payload otherwise. Exploration nodes (no `yieldPerVisit`)
 * and unreachable nodes score 0 and sink.
 */
export function yieldPerHour(state: GameState, loc: ResolvedLocation, resource: keyof Resources | null): number {
  if (loc.kind !== 'resource') return 0
  const amount = resource ? (loc.yieldPerVisit[resource] ?? 0) : sumYield(loc.yieldPerVisit)
  if (amount <= 0) return 0
  const roundTripMs = getTravelTime(state, loc.id) * 2 + loc.onSiteDurationMs
  if (!Number.isFinite(roundTripMs) || roundTripMs <= 0) return 0
  return (amount / roundTripMs) * MS_PER_HOUR
}

function matchesOwnership(loc: ResolvedLocation, ownership: NodeOwnership, sectId: SectId): boolean {
  const owner = loc.runtime.ownerId
  switch (ownership) {
    case 'all':
      return true
    case 'mine':
      return owner === sectId
    case 'unclaimed':
      return owner === undefined
    case 'rival':
      return owner !== undefined && owner !== sectId
  }
}

function matchesResource(loc: ResolvedLocation, resource: keyof Resources | null): boolean {
  if (!resource) return true
  return loc.kind === 'resource' && (loc.yieldPerVisit[resource] ?? 0) > 0
}

/** Exploration nodes carry `remainingCapacity: Infinity` and are never depleted. */
function isDepleted(loc: ResolvedLocation): boolean {
  return loc.runtime.remainingCapacity <= 0
}

function inScope(state: GameState, provinceId: ProvinceId, territoryId?: string): ResolvedLocation[] {
  return getVisibleLocations(state, provinceId).filter(
    (loc) => territoryId === undefined || (loc.kind === 'resource' && loc.territoryId === territoryId),
  )
}

function sortNodes(state: GameState, locs: ResolvedLocation[], filter: NodeBrowseFilter): ResolvedLocation[] {
  const arr = [...locs]
  const byTravel = (a: ResolvedLocation, b: ResolvedLocation) => getTravelTime(state, a.id) - getTravelTime(state, b.id)
  switch (filter.sort) {
    case 'nearest':
      arr.sort(byTravel)
      break
    case 'richest':
      arr.sort((a, b) => yieldPerHour(state, b, filter.resource) - yieldPerHour(state, a, filter.resource))
      break
    case 'safest':
      arr.sort((a, b) => a.dangerTier - b.dangerTier || byTravel(a, b))
      break
    case 'mine': {
      const mine = (loc: ResolvedLocation) => (loc.runtime.ownerId === state.sectId ? 0 : 1)
      arr.sort((a, b) => mine(a) - mine(b) || byTravel(a, b))
      break
    }
    case 'name':
      arr.sort((a, b) => a.name.localeCompare(b.name))
      break
  }
  return arr
}

export interface NodeBrowseResult {
  /** Filtered + ordered nodes to render. */
  locations: ResolvedLocation[]
  /** Nodes in region scope before any filter — the denominator in "N of M nodes". */
  totalInScope: number
  /** Nodes that pass every other filter but were hidden only because they're depleted. */
  hiddenDepletedCount: number
}

/**
 * The one browse entry point (§2): narrows a province's visible nodes by the
 * filter, orders them, and reports the counts the UI needs for its result badge
 * and empty states (§6). `hiddenDepletedCount` lets the component name the
 * "only depleted matches, and depleted are hidden" case specifically.
 */
export function browseNodes(state: GameState, provinceId: ProvinceId, filter: NodeBrowseFilter): NodeBrowseResult {
  const scope = inScope(state, provinceId, filter.territoryId)
  const passesNonDepleted = scope.filter(
    (loc) => matchesOwnership(loc, filter.ownership, state.sectId) && matchesResource(loc, filter.resource),
  )
  const visible = filter.hideDepleted ? passesNonDepleted.filter((loc) => !isDepleted(loc)) : passesNonDepleted
  const hiddenDepletedCount = filter.hideDepleted ? passesNonDepleted.length - visible.length : 0
  return {
    locations: sortNodes(state, visible, filter),
    totalInScope: scope.length,
    hiddenDepletedCount,
  }
}

/**
 * The resource keys the province's in-scope nodes actually yield, in
 * `RESOURCE_LABELS` order — so the picker never offers a resource no node has.
 */
export function availableResourceKeys(state: GameState, provinceId: ProvinceId, territoryId?: string): (keyof Resources)[] {
  const present = new Set<keyof Resources>()
  for (const loc of inScope(state, provinceId, territoryId)) {
    if (loc.kind !== 'resource') continue
    for (const key of Object.keys(loc.yieldPerVisit) as (keyof Resources)[]) {
      if ((loc.yieldPerVisit[key] ?? 0) > 0) present.add(key)
    }
  }
  return (Object.keys(RESOURCE_LABELS) as (keyof Resources)[]).filter((k) => present.has(k))
}
