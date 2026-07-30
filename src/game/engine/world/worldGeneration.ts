import type { GeneratedNodeRecord, ProvinceId, Resources } from '../../types'
import { getProvinceDef } from '../../data/world/provinceDefs'
import { getNodeTemplate, type NumberRange, type ResourceNodeTemplate } from '../../data/world/resourceNodeTemplates'

/**
 * Seeded, deterministic minor-node generation (WORLD_MAP_DESIGN §5.4 / §11).
 * `generateProvinceNodes(provinceId, seed)` is a pure function: the same
 * (worldSeed, provinceId) always produces the same records. Called at founding
 * for the founding province + its neighbours, and again on first discovery of a
 * new province. Its output is stored authoritatively in the save — never
 * re-derived on load — so a later edit to template ranges can't retroactively
 * mutate an existing world (§5.4).
 *
 * Produces nothing until templates + per-province weights are authored (Phase 6);
 * the machinery is complete now so that phase is pure data.
 */

/** Deterministic 32-bit hash of a province id, mixed with the world seed. */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32 — a small, fast, well-distributed seeded PRNG returning [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rollInt(rng: () => number, range: NumberRange): number {
  return Math.floor(range.min + rng() * (range.max - range.min + 1))
}

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
