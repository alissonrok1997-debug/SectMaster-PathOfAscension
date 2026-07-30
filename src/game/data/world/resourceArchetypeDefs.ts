import type { ResourceArchetypeId, Resources } from '../../types'

/**
 * Resource archetypes (WORLD_MAP_DESIGN §5.1 / §10.1). The archetype carries the
 * *mechanics* (which resources it yields, its icon/label); individual landmark
 * and generated-node definitions carry the *specifics* (actual yield amounts,
 * capacity, danger, distance). This split is what keeps hundreds of locations
 * authorable — a rebalance edits 7 archetypes, not every location.
 *
 * `resourceKeys` maps onto the six existing Resources (no new resource is
 * introduced, per §10), e.g. a jade quarry yields Spirit Stones and a spirit
 * crystal cave yields Qi Stone.
 */
export interface ResourceArchetypeDefinition {
  id: ResourceArchetypeId
  label: string
  icon: string
  resourceKeys: (keyof Resources)[]
  description: string
}

export const RESOURCE_ARCHETYPE_DEFS: ResourceArchetypeDefinition[] = [
  { id: 'spiritIronMine', label: 'Spirit Iron Mine', icon: '⛏️', resourceKeys: ['ironEssence'], description: 'Veins of spirit-infused iron, refined into Iron Essence.' },
  { id: 'jadeQuarry', label: 'Jade Quarry', icon: '🪨', resourceKeys: ['spiritStones'], description: 'Raw spirit jade cut and traded as Spirit Stones.' },
  { id: 'spiritHerbValley', label: 'Spirit Herb Valley', icon: '🌿', resourceKeys: ['spiritHerb'], description: 'Sheltered valleys thick with cultivation herbs.' },
  { id: 'beastHuntingGrounds', label: 'Beast Hunting Grounds', icon: '🐗', resourceKeys: ['ironEssence', 'spiritStones'], description: 'Spirit-beast ranges yielding materials and salvage.' },
  { id: 'spiritCrystalCave', label: 'Spirit Crystal Cave', icon: '💎', resourceKeys: ['qiStone'], description: 'Caverns of condensed Qi crystals.' },
  { id: 'ancientForest', label: 'Ancient Forest', icon: '🌲', resourceKeys: ['spiritWood'], description: 'Old-growth spirit timber for construction and crafting.' },
  { id: 'spiritSpring', label: 'Spirit Spring', icon: '⛲', resourceKeys: ['qiStone'], description: 'Qi-dense springs prized by cultivators.' },
]

export function getResourceArchetype(id: ResourceArchetypeId): ResourceArchetypeDefinition {
  const def = RESOURCE_ARCHETYPE_DEFS.find((a) => a.id === id)
  if (!def) throw new Error(`Unknown resource archetype id: ${id}`)
  return def
}
