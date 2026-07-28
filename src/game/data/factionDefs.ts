import type { FactionCategory } from '../types'

export interface FactionDefinition {
  id: string
  name: string
  category: FactionCategory
  description: string
  /**
   * doc 08 Section 5's Military Strength/Wealth/Knowledge/Stability
   * attributes — flavor-only display numbers (0-100), never read by any
   * formula, same precedent as `MissionDefinition.risk`. Only Relationship
   * (state, per-faction, engine/factions.ts) and Reputation (state, global)
   * are real mechanical values for this faction.
   */
  militaryStrength: number
  wealth: number
  knowledge: number
  stability: number
}

/**
 * 5 of doc 08 Section 4's 8 faction categories — Alchemy Association/
 * Forging Guild/Hidden Organizations skipped, no mechanical distinction
 * exists for them at MVP scope, same precedent as omitted research
 * branches (data/researchProjectDefs.ts).
 */
export const FACTION_DEFS: FactionDefinition[] = [
  {
    id: 'azureDawnSect',
    name: 'Azure Dawn Sect',
    category: 'Cultivation Sect',
    description: 'A rival cultivation sect from the next mountain range over — ambitious and quick to recruit.',
    militaryStrength: 55,
    wealth: 40,
    knowledge: 50,
    stability: 60,
  },
  {
    id: 'jadeRiverKingdom',
    name: 'Jade River Kingdom',
    category: 'Kingdom',
    description:
      'A mortal kingdom controlling the fertile valley below — weaker than a great sect, but it commands cities and taxes.',
    militaryStrength: 35,
    wealth: 70,
    knowledge: 30,
    stability: 75,
  },
  {
    id: 'goldenScaleMerchants',
    name: 'Golden Scale Merchant Guild',
    category: 'Merchant Guild',
    description: "Traders and caravan masters whose opinion moves prices across the region.",
    militaryStrength: 15,
    wealth: 85,
    knowledge: 25,
    stability: 65,
  },
  {
    id: 'bloodmoonCult',
    name: 'Bloodmoon Cult',
    category: 'Demonic Cult',
    description: 'A hostile, unpredictable faction that preys on outlying villages.',
    militaryStrength: 70,
    wealth: 30,
    knowledge: 20,
    stability: 25,
  },
  {
    id: 'silverPhoenixClan',
    name: 'Silver Phoenix Clan',
    category: 'Ancient Clan',
    description: 'An old bloodline family with elite disciples and deep political influence.',
    militaryStrength: 60,
    wealth: 55,
    knowledge: 65,
    stability: 70,
  },
]

export function getFactionDef(id: string): FactionDefinition {
  const def = FACTION_DEFS.find((f) => f.id === id)
  if (!def) throw new Error(`Unknown faction id: ${id}`)
  return def
}
