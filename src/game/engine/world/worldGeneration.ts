import type { GeneratedNodeRecord, GeneratedTerritory, OutpostUpgradePath, ProvinceId, Resources } from '../../types'
import { getProvinceDef } from '../../data/world/provinceDefs'
import { getNodeTemplate, type ResourceNodeTemplate } from '../../data/world/resourceNodeTemplates'
import { hashString, mulberry32, rollInt } from '../rng'
import type { WorldGenConfig } from './worldGen/worldGenConfig'

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

// --- Per-territory node generation (WORLD_PROCGEN_PLAN Wave 3) ------------------

/** Ray-cast point-in-polygon on a normalised ring. */
function pointInPolygon(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** A point inside the territory's cell (falls back to a small disc around the seat if there's no polygon). */
function placeInTerritory(t: GeneratedTerritory, rng: () => number): { x: number; y: number; distFromSeat: number } {
  const ring = t.polygon
  if (ring && ring.length >= 3) {
    let minX = 1
    let minY = 1
    let maxX = 0
    let maxY = 0
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    for (let tries = 0; tries < 24; tries++) {
      const x = minX + rng() * (maxX - minX)
      const y = minY + rng() * (maxY - minY)
      if (pointInPolygon(x, y, ring)) return { x, y, distFromSeat: Math.hypot(x - t.seat.x, y - t.seat.y) }
    }
  }
  // Fallback: a small jittered disc around the seat (legacy blueprints carry no polygon).
  const angle = rng() * Math.PI * 2
  const r = 0.02 + rng() * 0.05
  const x = Math.min(0.98, Math.max(0.02, t.seat.x + Math.cos(angle) * r))
  const y = Math.min(0.98, Math.max(0.02, t.seat.y + Math.sin(angle) * r))
  return { x, y, distFromSeat: r }
}

/** Weighted template pick within a region's biome pool. */
function pickTemplate(rng: () => number, weights: { templateId: string; weight: number }[]): ResourceNodeTemplate | undefined {
  const total = weights.reduce((a, w) => a + w.weight, 0)
  let roll = rng() * total
  for (const w of weights) {
    roll -= w.weight
    if (roll <= 0) return getNodeTemplate(w.templateId)
  }
  return getNodeTemplate(weights[weights.length - 1]?.templateId)
}

/** A claimable node's outpost upgrade path, scaled by danger and its primary yield resource. */
function rollUpgradePath(primaryKey: keyof Resources, dangerTier: number): OutpostUpgradePath {
  return {
    level1: {
      claimCost: { spiritStones: 100 + dangerTier * 40 },
      requiredReputation: Math.max(0, (dangerTier - 1) * 8),
      claimDurationMs: 22_000 + dangerTier * 4_000,
      bonus: { productionMultByResource: { [primaryKey]: Number((1.1 + dangerTier * 0.02).toFixed(2)) } },
    },
  }
}

/**
 * Generates every resource node in the realm, keyed per territory (Wave 3). Each territory gets 1–3
 * nodes: the first is its region's signature archetype (guaranteeing all four resource types exist),
 * the rest are biome-weighted. Nodes are placed inside the cell polygon; danger rises with region
 * temperament and distance from the seat; a claimable subset gets an outpost `upgradePath`. Seeded
 * per territory so a later territory's roll never shifts an earlier one. Output is stored
 * authoritatively in `world.generatedNodes`.
 */
export function generateTerritoryNodes(
  territories: GeneratedTerritory[],
  worldSeed: number,
  config: WorldGenConfig,
): GeneratedNodeRecord[] {
  const provinceId: ProvinceId = 'firstRealm'
  const nodes: GeneratedNodeRecord[] = []

  for (const t of territories) {
    const rng = mulberry32((hashString(`nodes:${t.id}`) ^ worldSeed) >>> 0)
    const count = rollInt(rng, config.nodeCountPerTerritory)
    const signature = getNodeTemplate(config.regionSignatureTemplate[t.regionId])
    // Danger is radial: a base that climbs toward the map centre, plus a temperament offset.
    const centerPull = 1 - Math.min(1, Math.hypot(t.seat.x - config.hub.cx, t.seat.y - config.hub.cy) / 0.65)
    const dangerBase = 1 + Math.round(centerPull * 2) + config.regionDangerOffset[t.regionId]

    for (let i = 0; i < count; i++) {
      const template = (i === 0 ? signature : undefined) ?? pickTemplate(rng, config.biomeNodeWeights[t.regionId])
      if (!template) continue

      const yieldPerVisit: Partial<Resources> = {}
      for (const key of template.yieldKeys) yieldPerVisit[key] = rollInt(rng, template.yieldPerVisitRange)

      const { x, y, distFromSeat } = placeInTerritory(t, rng)
      // Danger rises with region base + how deep into the wilds (distance from the seat) the node sits.
      const dangerTier = Math.min(5, Math.max(1, dangerBase + Math.round(distFromSeat * 12)))
      const claimable = rng() < config.claimableNodeFraction

      const fragment = template.nameFragments[Math.floor(rng() * template.nameFragments.length)] ?? 'Node'
      nodes.push({
        id: `${provinceId}.gen.${t.id}.${i}`,
        kind: 'resource',
        provinceId,
        territoryId: t.id,
        archetypeId: template.archetypeId,
        name: `${t.name} ${fragment}`,
        yieldPerVisit,
        capacity: rollInt(rng, template.capacityRange),
        regenPerDay: template.regenPerDayRange ? rollInt(rng, template.regenPerDayRange) : undefined,
        dangerTier,
        travelUnits: rollInt(rng, template.travelUnitsRange),
        mapPosition: { x, y },
        maxParty: rollInt(rng, template.maxPartyRange),
        onSiteDurationMs: rollInt(rng, template.onSiteDurationMsRange),
        upgradePath: claimable ? rollUpgradePath(template.yieldKeys[0], dangerTier) : undefined,
      })
    }
  }
  return nodes
}
