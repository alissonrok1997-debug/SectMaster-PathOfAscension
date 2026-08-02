import type { GeneratedNodeRecord, ProvinceId, Resources } from '../../types'
import { getProvinceDef } from '../../data/world/provinceDefs'
import { getNodeTemplate, type ResourceNodeTemplate } from '../../data/world/resourceNodeTemplates'
import { hashString, mulberry32, rollInt } from '../rng'

/**
 * Seeded, deterministic minor-node generation (WORLD_MAP_DESIGN §5.4 / §11).
 * `generateProvinceNodes(provinceId, seed)` is a pure function: the same
 * (worldSeed, provinceId) always produces the same records. Called at founding
 * for the founding province + its neighbours, and again on first discovery of a
 * new province. Its output is stored authoritatively in the save — never
 * re-derived on load — so a later edit to template ranges can't retroactively
 * mutate an existing world (§5.4).
 *
 * The First Realm build hand-authors its 52 resource nodes as landmarks
 * instead (FIRST_REALM_PLAN §3b), so this stays unused (empty templates/
 * weights) for now; the machinery is kept intact for future procedural content.
 */

function buildNode(
  provinceId: ProvinceId,
  provinceName: string,
  template: ResourceNodeTemplate,
  rng: () => number,
  index: number,
): GeneratedNodeRecord {
  const yieldPerVisit: Partial<Resources> = {}
  for (const key of template.yieldKeys) {
    yieldPerVisit[key] = rollInt(rng, template.yieldPerVisitRange)
  }
  const fragment = template.nameFragments[Math.floor(rng() * template.nameFragments.length)] ?? 'Node'
  return {
    id: `${provinceId}.gen.${index}`,
    kind: 'resource',
    provinceId,
    archetypeId: template.archetypeId,
    name: `${provinceName} ${fragment}`,
    yieldPerVisit,
    capacity: rollInt(rng, template.capacityRange),
    regenPerDay: template.regenPerDayRange ? rollInt(rng, template.regenPerDayRange) : undefined,
    dangerTier: rollInt(rng, template.dangerTierRange),
    travelUnits: rollInt(rng, template.travelUnitsRange),
    mapPosition: { x: rng(), y: rng() },
    maxParty: rollInt(rng, template.maxPartyRange),
    onSiteDurationMs: rollInt(rng, template.onSiteDurationMsRange),
  }
}

export function generateProvinceNodes(provinceId: ProvinceId, worldSeed: number): GeneratedNodeRecord[] {
  const province = getProvinceDef(provinceId)
  const rng = mulberry32((worldSeed ^ hashString(provinceId)) >>> 0)
  const nodes: GeneratedNodeRecord[] = []
  let index = 0
  for (const weight of province.nodeTemplateWeights) {
    const template = getNodeTemplate(weight.templateId)
    if (!template) continue
    const count = rollInt(rng, { min: weight.minCount, max: weight.maxCount })
    for (let i = 0; i < count; i++) {
      nodes.push(buildNode(province.id, province.name, template, rng, index++))
    }
  }
  return nodes
}
