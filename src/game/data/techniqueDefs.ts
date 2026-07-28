import type { Resources, TechniqueGrade } from '../types'

export interface TechniqueDefinition {
  id: string
  name: string
  description: string
  grade: TechniqueGrade
  /** Which research project discovers this technique (doc 10 §9). */
  requiredResearchId: string
  teachCost: Partial<Resources>
  teachDurationMs: number
  /** Item consumed from the sect inventory when teaching starts (doc 10 §10 "sometimes resources"; doc 07 Category 4 "Manuals are consumed when learned"). */
  requiredItemDefId?: string
  /** Flat Combat Power bonus once known (doc 06 §2's documented-but-omitted Techniques CP input). */
  combatPowerBonus: number
}

/**
 * MVP has exactly one technique — this is the payoff for the Sword Manual
 * item crafted in Wave 5, which was explicitly left inert pending this
 * system. Higher grades (Rare and above) are reserved for later content.
 */
export const TECHNIQUE_DEFS: TechniqueDefinition[] = [
  {
    id: 'swordTechnique',
    name: 'Foundational Sword Technique',
    description: 'A disciplined sword form taught from the Sword Manual, sharpening the disciple\'s combat effectiveness.',
    grade: 'Common',
    requiredResearchId: 'martialArtsSwordTechnique',
    teachCost: { knowledge: 20 },
    teachDurationMs: 15_000,
    requiredItemDefId: 'swordManual',
    combatPowerBonus: 12,
  },
]

export function getTechniqueDef(id: string): TechniqueDefinition {
  const def = TECHNIQUE_DEFS.find((t) => t.id === id)
  if (!def) throw new Error(`Unknown technique id: ${id}`)
  return def
}
