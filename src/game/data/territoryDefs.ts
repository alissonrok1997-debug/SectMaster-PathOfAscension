import type { Resources } from '../types'

export interface TerritoryDefinition {
  id: string
  name: string
  description: string
  claimCost: Partial<Resources>
  requiredReputation: number
  claimDurationMs: number
  /** Real, honest production hook (doc 08 Section 9's own examples), consumed by `getTerritoryProductionBonus`. */
  productionBonus: { resourceKey: keyof Resources; multiplier: number }
}

/**
 * doc 08 Section 9's own four named examples, used directly rather than
 * inventing a larger roster — MVP flattens the full Continent -> Region ->
 * Territory -> Location hierarchy (doc 08 Section 2) down to this single
 * list, same collapse Wave 1 did for Sect Rank's gate list. Ownership never
 * changes hands once claimed — territory conflict/loss is explicitly Wave
 * 9 backlog.
 */
export const TERRITORY_DEFS: TerritoryDefinition[] = [
  {
    id: 'spiritMine',
    name: 'Spirit Mine',
    description: 'Produces Spirit Stones.',
    claimCost: { spiritStones: 150, ironEssence: 30 },
    requiredReputation: 0,
    claimDurationMs: 30_000,
    productionBonus: { resourceKey: 'spiritStones', multiplier: 0.15 },
  },
  {
    id: 'ancientForest',
    name: 'Ancient Forest',
    description: 'Produces herbs.',
    claimCost: { spiritStones: 120, spiritWood: 40 },
    requiredReputation: 10,
    claimDurationMs: 30_000,
    productionBonus: { resourceKey: 'spiritHerb', multiplier: 0.2 },
  },
  {
    id: 'tradeCity',
    name: 'Trade City',
    description: 'Improves commerce.',
    claimCost: { spiritStones: 250 },
    requiredReputation: 20,
    claimDurationMs: 40_000,
    productionBonus: { resourceKey: 'spiritStones', multiplier: 0.15 },
  },
  {
    id: 'sacredMountain',
    name: 'Sacred Mountain',
    description: 'Generates Qi Stone.',
    claimCost: { spiritStones: 300, qiStone: 20 },
    requiredReputation: 35,
    claimDurationMs: 45_000,
    productionBonus: { resourceKey: 'qiStone', multiplier: 0.25 },
  },
]

export function getTerritoryDef(id: string): TerritoryDefinition {
  const def = TERRITORY_DEFS.find((t) => t.id === id)
  if (!def) throw new Error(`Unknown territory id: ${id}`)
  return def
}
