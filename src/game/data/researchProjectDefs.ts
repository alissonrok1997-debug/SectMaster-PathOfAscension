import type { ResearchCategory, ResearchEffectType, Resources } from '../types'

export interface ResearchProjectDefinition {
  id: string
  name: string
  category: ResearchCategory
  description: string
  requiredBuildingId: string
  cost: Partial<Resources>
  durationMs: number
  effect: ResearchEffectType
  /** Proportional bonus/reduction, e.g. 0.2 = +20%. Absent for 'unlockTechnique'. */
  effectValue?: number
  /** Only for effect === 'unlockTechnique' (doc 10 §9 — technique discovery). */
  unlocksTechniqueId?: string
}

/**
 * MVP "basic research tree" (doc 10 §18) — one project per branch that has
 * a real existing system to hook into (dev-placeholder cost/duration scale,
 * same convention as every prior wave's tuning). Forging/Exploration/
 * Mysticism are skipped — no honest hook exists for them yet, same
 * precedent as Wave 5 skipping Inscription/Artifact Restoration. Diplomacy
 * gained a real hook in Wave 7 (diplomatic action cost reduction).
 */
export const RESEARCH_PROJECT_DEFS: ResearchProjectDefinition[] = [
  {
    id: 'sectAdministrationStorage',
    name: 'Efficient Storage Ledgers',
    category: 'Sect Administration',
    description: 'Better record-keeping squeezes more out of every warehouse and vault.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 40 },
    durationMs: 20_000,
    effect: 'storageCap',
    effectValue: 0.2,
  },
  {
    id: 'cultivationDeeperMeditation',
    name: 'Deeper Meditation Techniques',
    category: 'Cultivation',
    description: 'Refined breathing and meditation methods speed up every disciple\'s cultivation.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 45, spiritHerb: 20 },
    durationMs: 25_000,
    effect: 'cultivationRate',
    effectValue: 0.15,
  },
  {
    id: 'martialArtsSwordTechnique',
    name: 'Sword Technique Compilation',
    category: 'Martial Arts',
    description: 'Compiles scattered sword forms into a teachable manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 60 },
    durationMs: 30_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'swordTechnique',
  },
  // --- Crafting Recipe Pack, Phase 2: manual technique unlocks (CRAFTING_RECIPE_PACK.md §7) ---
  {
    id: 'martialArtsSaberTechnique',
    name: 'Saber Form Compilation',
    category: 'Martial Arts',
    description: 'Compiles a wandering master\'s saber notes into a teachable manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 65 },
    durationMs: 32_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'rushingTorrentSaber',
  },
  {
    id: 'martialArtsSpearTechnique',
    name: 'Spear Doctrine of the Coiling Dragon',
    category: 'Martial Arts',
    description: 'Systematizes the coiling dragon spear form into a teachable manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 130 },
    durationMs: 55_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'coilingDragonSpear',
  },
  {
    id: 'martialArtsIronPalm',
    name: 'Vajra Palm Treatises',
    category: 'Martial Arts',
    description: 'Assembles the iron palm conditioning regimen into a teachable manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 120 },
    durationMs: 50_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'vajraIronPalm',
  },
  {
    id: 'martialArtsGoldenBell',
    name: 'Golden Bell Body Doctrine',
    category: 'Martial Arts',
    description: 'Reconstructs the complete Golden Bell body-tempering doctrine into a teachable manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 240 },
    durationMs: 95_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'goldenBellShroud',
  },
  {
    id: 'martialArtsFlyingSword',
    name: 'Flying Sword Sublimation',
    category: 'Martial Arts',
    description: 'Sublimates the flying-sword diagrams into a teachable heaven-grade manual technique.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 460 },
    durationMs: 180_000,
    effect: 'unlockTechnique',
    unlocksTechniqueId: 'flyingSwordControl',
  },
  {
    id: 'alchemyEfficientProcesses',
    name: 'Efficient Alchemical Processes',
    category: 'Alchemy',
    description: 'Streamlined brewing steps cut time off every Alchemy-discipline recipe.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 45, spiritStones: 30 },
    durationMs: 22_000,
    effect: 'craftingSpeed',
    effectValue: 0.2,
  },
  {
    id: 'diplomacyCourtEtiquette',
    name: 'Court Etiquette & Envoy Protocols',
    category: 'Diplomacy',
    description:
      'Trained envoys negotiate more efficiently, reducing the resource cost of every diplomatic action.',
    requiredBuildingId: 'researchInstitute',
    cost: { knowledge: 50, spiritStones: 40 },
    durationMs: 24_000,
    effect: 'diplomacyCost',
    effectValue: 0.25,
  },
]

export function getResearchProjectDef(id: string): ResearchProjectDefinition {
  const def = RESEARCH_PROJECT_DEFS.find((p) => p.id === id)
  if (!def) throw new Error(`Unknown research project id: ${id}`)
  return def
}
