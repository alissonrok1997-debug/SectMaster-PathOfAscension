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

  // --- Crafting Recipe Pack, Phase 2: manual-taught techniques (CRAFTING_RECIPE_PACK.md §7) ---
  {
    id: 'rushingTorrentSaber',
    name: 'Rushing Torrent Saber',
    description: 'A relentless saber form of overlapping cuts, taught from the Saber Manual.',
    grade: 'Common',
    requiredResearchId: 'martialArtsSaberTechnique',
    teachCost: { knowledge: 24 },
    teachDurationMs: 16_000,
    requiredItemDefId: 'saberManual',
    combatPowerBonus: 14,
  },
  {
    id: 'coilingDragonSpear',
    name: 'Coiling Dragon Spear',
    description: 'A spear doctrine of winding, unpredictable thrusts, taught from the Spear Manual.',
    grade: 'Rare',
    requiredResearchId: 'martialArtsSpearTechnique',
    teachCost: { knowledge: 45 },
    teachDurationMs: 30_000,
    requiredItemDefId: 'spearManual',
    combatPowerBonus: 22,
  },
  {
    id: 'vajraIronPalm',
    name: 'Vajra Iron Palm',
    description: 'A hardened striking art that turns the palm into a weapon, taught from the Iron Palm Manual.',
    grade: 'Rare',
    requiredResearchId: 'martialArtsIronPalm',
    teachCost: { knowledge: 40 },
    teachDurationMs: 28_000,
    requiredItemDefId: 'ironPalmManual',
    combatPowerBonus: 20,
  },
  {
    id: 'goldenBellShroud',
    name: 'Golden Bell Shroud',
    description: 'A body-tempering doctrine that rings the body in defensive force, taught from the Body Tempering Manual.',
    grade: 'Advanced',
    requiredResearchId: 'martialArtsGoldenBell',
    teachCost: { knowledge: 80 },
    teachDurationMs: 55_000,
    requiredItemDefId: 'bodyTemperingManual',
    combatPowerBonus: 32,
  },
  // --- Crafting Recipe Pack, Phase 3: material-gated manual technique (CRAFTING_RECIPE_PACK.md §7) ---
  {
    id: 'flyingSwordControl',
    name: 'Flying Sword Control',
    description: 'A heaven-grade art of guiding a sword in flight, taught from the Flying Sword Manual — the largest single technique bonus in the sect.',
    grade: 'Heaven Grade',
    requiredResearchId: 'martialArtsFlyingSword',
    teachCost: { knowledge: 160 },
    teachDurationMs: 110_000,
    requiredItemDefId: 'flyingSwordManual',
    combatPowerBonus: 55,
  },
]

export function getTechniqueDef(id: string): TechniqueDefinition {
  const def = TECHNIQUE_DEFS.find((t) => t.id === id)
  if (!def) throw new Error(`Unknown technique id: ${id}`)
  return def
}
