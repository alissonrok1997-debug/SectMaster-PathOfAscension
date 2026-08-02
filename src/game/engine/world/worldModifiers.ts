import type { GameState, Resources, SiteModifierBundle } from '../../types'
import { getSectSiteDef } from '../../data/world/sectSiteDefs'
import { getLandmarkDef } from '../../data/world/landmarkDefs'
import { getWorldEventModifiers } from '../worldEvents'
import { getSectSpiritVein } from './worldQueries'

/**
 * The single seam that aggregates every world-map modifier into one bundle
 * (WORLD_MAP_DESIGN §11.3): the founded sect site, its province's Spirit Vein,
 * the active world event, and — from Phase 5 — owned outposts. `production.ts` /
 * `cultivation.ts` / `construction` / `upkeep` consume THIS and never import
 * sectSiteDefs or spiritVeinDefs directly, so the bonuses can never end up
 * applied in four files with four different orders of operations. This is also
 * the natural unit-test target: given a state, assert one bundle.
 */
function identityBundle(): SiteModifierBundle {
  return {
    cultivationSpeedMult: 1,
    productionMultByResource: {},
    defenceMult: 1,
    travelTimeMult: 1,
    recruitmentRateMult: 1,
    upkeepMult: 1,
    buildTimeMult: 1,
  }
}

function multiplyResourceMap(
  into: Partial<Record<keyof Resources, number>>,
  from: Partial<Record<keyof Resources, number>>,
): void {
  for (const [key, mult] of Object.entries(from) as [keyof Resources, number][]) {
    into[key] = (into[key] ?? 1) * mult
  }
}

/** Merges a partial bundle (an outpost / future province-control contribution) into the aggregate. */
function mergeBundle(into: SiteModifierBundle, from: Partial<SiteModifierBundle>): void {
  if (from.cultivationSpeedMult) into.cultivationSpeedMult *= from.cultivationSpeedMult
  if (from.defenceMult) into.defenceMult *= from.defenceMult
  if (from.travelTimeMult) into.travelTimeMult *= from.travelTimeMult
  if (from.recruitmentRateMult) into.recruitmentRateMult *= from.recruitmentRateMult
  if (from.upkeepMult) into.upkeepMult *= from.upkeepMult
  if (from.buildTimeMult) into.buildTimeMult *= from.buildTimeMult
  if (from.productionMultByResource) multiplyResourceMap(into.productionMultByResource, from.productionMultByResource)
}

export function getWorldModifiers(state: GameState): SiteModifierBundle {
  const bundle = identityBundle()

  if (state.sectLocation) {
    const site = getSectSiteDef(state.sectLocation.sectSiteId).modifiers
    bundle.cultivationSpeedMult *= site.cultivationSpeedMult
    bundle.defenceMult *= site.defenceMult
    bundle.travelTimeMult *= site.travelTimeMult
    bundle.recruitmentRateMult *= site.recruitmentRateMult
    bundle.upkeepMult *= site.upkeepMult
    bundle.buildTimeMult *= site.buildTimeMult
    multiplyResourceMap(bundle.productionMultByResource, site.productionMultByResource)

    // Spirit Vein (§7): the province's vein colours cultivation speed. Its
    // recruit-quality effect is a non-bundle axis applied in recruitment.
    bundle.cultivationSpeedMult *= getSectSpiritVein(state).cultivationMult
  }

  // Active world event (§11): folds its production / cultivation modifiers into
  // the same bundle rather than being applied separately in production.ts.
  const event = getWorldEventModifiers(state)
  bundle.cultivationSpeedMult *= event.cultivationRateMult
  multiplyResourceMap(bundle.productionMultByResource, event.productionMult)

  // Owned outposts (§5.3 / §11.3): every claimed location (outpostLevel ≥ 1) folds
  // its upgradePath bonus in here — the single pipe that replaced the retired
  // getTerritoryProductionBonus. Iterates only the SPARSE touched-location runtime,
  // never all location defs, so it stays O(claimed), not O(world) (§9.3).
  if (state.world) {
    for (const [locationId, runtime] of Object.entries(state.world.locations)) {
      if (runtime.outpostLevel < 1) continue
      const def = getLandmarkDef(locationId)
      if (def && def.kind === 'resource' && def.upgradePath) {
        mergeBundle(bundle, def.upgradePath.level1.bonus)
      }
    }
  }

  return bundle
}
