import type { MapPosition, RegionId, SectSiteId, WorldState } from '../../types'

/**
 * Region-partitioned decision indices (FIRST_REALM_PLAN §4.3). An acting NPC sect evaluates
 * targets only within its own region + adjacent regions, so a climb/raid/claim decision costs
 * O(local neighbourhood) instead of O(all 64 sites) — what keeps the sim off the O(N²) cliff.
 *
 * Region adjacency is derived per seed from the actual Voronoi/Delaunay territory-neighbour
 * crossings (two regions are adjacent iff a territory in one borders a territory in the other), not
 * a hardcoded ring — so it stays correct however the corners are shuffled, yields the ring+hub for
 * the quadrant layout, and recovers the old west→east chain for legacy belt saves. From
 * WORLD_PROCGEN_PLAN Wave 2 the site→region mapping is generated per seed, so the whole index is
 * built from `world.blueprint.territories` and cached by seed (recomputed on load, the worldGraph
 * "compute once at init" discipline keyed off the seed).
 */
interface RegionIndexData {
  siteToRegion: Record<SectSiteId, RegionId>
  regionToSites: Record<RegionId, SectSiteId[]>
  /** Region → adjacent regions, derived from the Delaunay territory-neighbour crossings for this seed. */
  regionAdjacency: Record<RegionId, RegionId[]>
  seats: Array<{ id: SectSiteId; regionId: RegionId; pos: MapPosition }>
}

function buildIndex(world: WorldState | undefined): RegionIndexData {
  const siteToRegion: Record<SectSiteId, RegionId> = {}
  const regionToSites: Record<RegionId, SectSiteId[]> = { spiritMountain: [], ancientForest: [], desert: [], forgottenRuins: [], heavenlyAxis: [] }
  const seats: RegionIndexData['seats'] = []
  const territories = world?.blueprint?.territories ?? []
  for (const t of territories) {
    siteToRegion[t.id] = t.regionId
    regionToSites[t.regionId].push(t.id)
    seats.push({ id: t.id, regionId: t.regionId, pos: t.seat })
  }
  // Region adjacency from territory-neighbour crossings — a second pass, so neighbours that appear
  // later in the list resolve. Undirected: an A→B crossing records B on A and A on B.
  const adjSets = new Map<RegionId, Set<RegionId>>()
  const bucket = (r: RegionId) => {
    let set = adjSets.get(r)
    if (!set) adjSets.set(r, (set = new Set()))
    return set
  }
  for (const t of territories) {
    bucket(t.regionId) // ensure every region has an entry, even one with no cross-region border
    for (const nId of t.neighbours) {
      const to = siteToRegion[nId]
      if (to && to !== t.regionId) {
        bucket(t.regionId).add(to)
        bucket(to).add(t.regionId)
      }
    }
  }
  const regionAdjacency = {} as Record<RegionId, RegionId[]>
  for (const [region, set] of adjSets) regionAdjacency[region] = [...set]
  return { siteToRegion, regionToSites, regionAdjacency, seats }
}

// Cache the index by world seed — the territories are fixed for a given world, so this recomputes
// only when a different world is loaded.
let cache: { seed: number; data: RegionIndexData } | null = null
function getIndex(world: WorldState | undefined): RegionIndexData {
  const seed = world?.seed ?? -1
  if (cache && cache.seed === seed) return cache.data
  const data = buildIndex(world)
  cache = { seed, data }
  return data
}

export function getRegionForSite(world: WorldState | undefined, siteId: SectSiteId): RegionId | undefined {
  return getIndex(world).siteToRegion[siteId]
}

/**
 * The region a map position belongs to — the region of its nearest seat. Resource nodes carry no
 * region of their own, so this reconstructs the grouping from the seat anchors, working uniformly
 * for handcrafted landmarks and generated nodes.
 */
export function getRegionForPosition(world: WorldState | undefined, pos: MapPosition): RegionId {
  const { seats } = getIndex(world)
  let best: RegionId = seats[0]?.regionId ?? 'spiritMountain'
  let bestDist = Infinity
  for (const seat of seats) {
    const dist = Math.hypot(seat.pos.x - pos.x, seat.pos.y - pos.y)
    if (dist < bestDist) {
      bestDist = dist
      best = seat.regionId
    }
  }
  return best
}

/** Every sect site in `regionId` plus every adjacent region — the scope an acting sect evaluates (§4.3). */
export function getSitesInScope(world: WorldState | undefined, regionId: RegionId): SectSiteId[] {
  const { regionToSites, regionAdjacency } = getIndex(world)
  return [regionId, ...(regionAdjacency[regionId] ?? [])].flatMap((r) => regionToSites[r] ?? [])
}
