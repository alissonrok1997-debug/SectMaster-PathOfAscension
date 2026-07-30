import type { GameState, Resources, SiteModifierBundle } from '../../types'
import { getSectSiteDef } from '../../data/world/sectSiteDefs'
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

  // Phase 5 folds owned-outpost contributions in here too (§5.3 / §11.3).
  return bundle
}
