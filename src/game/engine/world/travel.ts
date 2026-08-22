import type { ExpeditionPurpose, GameState, LocationId, Resources } from '../../types'
import { MS_PER_MAP_DISTANCE } from '../../data/world/travelConstants'
import { getSite } from './worldAccess'
import { getExpeditionTargetMeta, getLocation } from './worldQueries'
import { getLocationPosition } from './influence'
import { getWorldModifiers } from './worldModifiers'

/**
 * Travel time (WORLD_MAP_DESIGN §8.2): the straight-line map distance from the
 * seat to the target × a single ms-per-map-unit dial. This is the *same* metric
 * the influence bubble uses (engine/world/influence.ts), so a node that reads as
 * closer on the map is always a shorter trip and the round-trip the UI shows can
 * never contradict what the player sees — `mapPosition` is now a real simulation
 * input. The site + world-event `travelTimeMult` reach this through the
 * aggregated bundle (§11.3), which is why Cliff Plateau (×1.2) and River Basin
 * (×0.9) measurably change every trip.
 *
 * `getLocationPosition` unifies resource-node and sect-site targets (Claim/Raid
 * can hit either, §4.2). A party-speed term (§8.2's "slowest member governs") is
 * deliberately omitted: no disciple travel-speed stat exists yet, so faking one
 * would be dishonest. Returns Infinity for an unfounded sect or an unreachable /
 * unknown target.
 */
export function getTravelTime(state: GameState, locationId: LocationId, _purpose: ExpeditionPurpose = 'gather'): number {
  if (!state.sectLocation) return Infinity
  const seat = getSite(state.world, state.sectLocation.sectSiteId).mapPosition
  const target = getLocationPosition(state, locationId)
  if (!target) return Infinity

  const dist = Math.hypot(target.x - seat.x, target.y - seat.y)
  return Math.round(dist * MS_PER_MAP_DISTANCE * getWorldModifiers(state).travelTimeMult)
}

export interface ExpeditionPreview {
  /** Reachable at all — false for an unknown/unreachable target or unfounded sect. */
  reachable: boolean
  outboundMs: number
  onSiteMs: number
  returnMs: number
  /** How many cycles will actually run: the order, capped by remaining capacity. */
  effectiveCycles: number
  totalMs: number
  /** Best-case payload (no incidents) for the effective cycles. */
  estimatedYield: Partial<Resources>
}

/** Adds `from` into `into` in place (mutating), summing shared resource keys. */
function addResources(into: Partial<Resources>, from: Partial<Resources>): void {
  for (const [key, amount] of Object.entries(from) as [keyof Resources, number][]) {
    into[key] = (into[key] ?? 0) + amount
  }
}

/**
 * The full dispatch preview the UI shows (§8.2 / §12.3): timing, effective cycle
 * count (clamped to remaining capacity), and best-case yield. Kept in the engine
 * so the modal never computes game logic itself (§12.5).
 */
export function getExpeditionPreview(
  state: GameState,
  locationId: LocationId,
  cycleTarget: number,
  purpose: ExpeditionPurpose = 'gather',
): ExpeditionPreview {
  const outboundMs = getTravelTime(state, locationId, purpose)
  if (outboundMs === Infinity) {
    return { reachable: false, outboundMs: 0, onSiteMs: 0, returnMs: 0, effectiveCycles: 0, totalMs: 0, estimatedYield: {} }
  }

  // Claim/Raid/Survey always run a single on-site cycle (a battle or a scan, not a repeatable gather) — timing comes from getExpeditionTargetMeta, which also covers sect-site targets.
  if (purpose !== 'gather') {
    const meta = getExpeditionTargetMeta(state, locationId, purpose)
    if (!meta) return { reachable: false, outboundMs: 0, onSiteMs: 0, returnMs: 0, effectiveCycles: 0, totalMs: 0, estimatedYield: {} }
    return {
      reachable: true,
      outboundMs,
      onSiteMs: meta.onSiteDurationMs,
      returnMs: outboundMs,
      effectiveCycles: 1,
      totalMs: outboundMs * 2 + meta.onSiteDurationMs,
      estimatedYield: {},
    }
  }

  const location = getLocation(state, locationId)
  if (!location || location.kind !== 'resource') {
    return { reachable: false, outboundMs: 0, onSiteMs: 0, returnMs: 0, effectiveCycles: 0, totalMs: 0, estimatedYield: {} }
  }

  const remainingCapacity = location.runtime.remainingCapacity
  const effectiveCycles = Math.max(0, Math.min(cycleTarget, remainingCapacity))
  const onSiteMs = location.onSiteDurationMs

  const estimatedYield: Partial<Resources> = {}
  for (let i = 0; i < effectiveCycles; i++) addResources(estimatedYield, location.yieldPerVisit)

  return {
    reachable: true,
    outboundMs,
    onSiteMs,
    returnMs: outboundMs,
    effectiveCycles,
    totalMs: outboundMs * 2 + onSiteMs * effectiveCycles,
    estimatedYield,
  }
}
