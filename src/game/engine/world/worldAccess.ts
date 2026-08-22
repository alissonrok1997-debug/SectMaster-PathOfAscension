import type { SectSiteId, WorldState } from '../../types'
import type { SectSiteDefinition } from '../../data/world/sectSiteDefs'
import type { ProvinceDefinition } from '../../data/world/provinceDefs'

/**
 * The world-access seam (WORLD_PROCGEN_PLAN). Every engine consumer and component routes
 * site/province lookups through here, reading the stored `world.blueprint` — the single
 * authoritative source once a world is founded.
 *
 * The Wave 1 module-def fallback is gone (Wave 5 cutover): the generator is the only path, so the
 * authored `SECT_SITE_DEFS`/`PROVINCE_DEFS` no longer feed any runtime read — they survive only
 * behind `buildLegacyBlueprint` in the save migration. Only the def *shapes* are imported here
 * (types, erased at compile). A lookup with no blueprint means "called before founding", which
 * never happens for these consumers, so it fails fast rather than papering over the bug.
 */

export function getSite(world: WorldState | undefined, id: SectSiteId): SectSiteDefinition {
  const site = world?.blueprint?.sites[id]
  if (!site) throw new Error(`getSite: no blueprint site '${id}' — world not founded?`)
  return site
}

export function getSites(world: WorldState | undefined): SectSiteDefinition[] {
  return world?.blueprint ? Object.values(world.blueprint.sites) : []
}

export function getProvince(world: WorldState | undefined): ProvinceDefinition {
  const province = world?.blueprint?.province
  if (!province) throw new Error('getProvince: no blueprint — world not founded?')
  return province
}
