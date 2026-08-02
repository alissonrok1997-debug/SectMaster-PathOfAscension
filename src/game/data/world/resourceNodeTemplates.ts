import type { Resources, ResourceArchetypeId } from '../../types'
import type { NumberRange } from '../../engine/rng'

/**
 * Generator templates for minor resource nodes (WORLD_MAP_DESIGN §5.4 / §10). A
 * template supplies an archetype plus *ranges* the seeded generator rolls within,
 * and a name-fragment table. Landmarks carry specifics; templates carry volume.
 *
 * Empty in this phase: the founding flow already calls generateProvinceNodes, but
 * every province's `nodeTemplateWeights` is empty, so no minor nodes are produced
 * yet. The content scale-out phase (§16 Phase 6) fills both sides in — with no
 * engine or type change required, which is the property that phase tests.
 */
export interface ResourceNodeTemplate {
  id: string
  archetypeId: ResourceArchetypeId
  /** Name fragments combined with the province name to name a generated node. */
  nameFragments: string[]
  /** Which resource(s) a rolled node yields; amounts come from yieldPerVisitRange. */
  yieldKeys: (keyof Resources)[]
  yieldPerVisitRange: NumberRange
  capacityRange: NumberRange
  regenPerDayRange?: NumberRange
  dangerTierRange: NumberRange
  travelUnitsRange: NumberRange
  maxPartyRange: NumberRange
  onSiteDurationMsRange: NumberRange
}

export const RESOURCE_NODE_TEMPLATES: ResourceNodeTemplate[] = []

export function getNodeTemplate(id: string): ResourceNodeTemplate | undefined {
  return RESOURCE_NODE_TEMPLATES.find((t) => t.id === id)
}
