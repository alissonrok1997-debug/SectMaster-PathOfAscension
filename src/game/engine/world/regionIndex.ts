import type { MapPosition, RegionId, SectSiteId } from '../../types'
import { SECT_SITE_DEFS } from '../../data/world/sectSiteDefs'

/**
 * Region-partitioned decision indices (FIRST_REALM_PLAN §4.3) — precomputed
 * once from the static site defs, never touched again. An acting NPC sect
 * evaluates targets only within its own region + adjacent regions, so a
 * climb/raid/claim decision costs O(local neighbourhood) instead of O(all 32
 * sites), which is what keeps the sim off the O(N²) cliff as the sect count
 * grows (§4.3's core scaling constraint).
 *
 * The four regions sit in a west-to-east belt (Wave A's mapPosition layout:
 * Spirit Mountain → Ancient Forest → Desert → Forgotten Ruins), so adjacency
 * is a simple linear chain — each region borders only its immediate neighbour(s).
 */
const REGION_ADJACENCY: Record<RegionId, RegionId[]> = {
  spiritMountain: ['ancientForest'],
  ancientForest: ['spiritMountain', 'desert'],
  desert: ['ancientForest', 'forgottenRuins'],
  forgottenRuins: ['desert'],
}

const siteToRegion: Record<SectSiteId, RegionId> = {}
for (const site of SECT_SITE_DEFS) {
  siteToRegion[site.id] = site.regionId
}

const regionToSites: Record<RegionId, SectSiteId[]> = {
  spiritMountain: [],
  ancientForest: [],
  desert: [],
  forgottenRuins: [],
}
for (const site of SECT_SITE_DEFS) {
  regionToSites[site.regionId].push(site.id)
}

export function getRegionForSite(siteId: SectSiteId): RegionId | undefined {
  return siteToRegion[siteId]
}

/**
 * The region a map position belongs to — the region of its nearest sect site.
 * Resource nodes carry no region field of their own (they're authored in region
 * clusters but only as `mapPosition`), so this reconstructs the grouping from the
 * site anchors, working uniformly for handcrafted landmarks and generated nodes.
 */
export function getRegionForPosition(pos: MapPosition): RegionId {
  let best: RegionId = SECT_SITE_DEFS[0].regionId
  let bestDist = Infinity
  for (const site of SECT_SITE_DEFS) {
    const dist = Math.hypot(site.mapPosition.x - pos.x, site.mapPosition.y - pos.y)
    if (dist < bestDist) {
      bestDist = dist
      best = site.regionId
    }
  }
  return best
}

/** Every sect site in `regionId` plus every adjacent region — the scope an acting sect evaluates (§4.3). */
export function getSitesInScope(regionId: RegionId): SectSiteId[] {
  const regions = [regionId, ...REGION_ADJACENCY[regionId]]
  return regions.flatMap((r) => regionToSites[r])
}
