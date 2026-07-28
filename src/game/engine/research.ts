import type { GameState, Resources } from '../types'
import { getResearchProjectDef, RESEARCH_PROJECT_DEFS } from '../data/researchProjectDefs'
import { getBuildingDef } from '../data/buildingDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'
import type { CraftingRecipe } from '../data/craftingRecipes'

export interface ResearchEligibility {
  canResearch: boolean
  reason?: string
}

/** Single source of truth for whether a research project can be started — shared by the Research Screen and the store guard, same pattern as getCraftEligibility. */
export function getResearchEligibility(state: GameState, projectId: string): ResearchEligibility {
  const def = getResearchProjectDef(projectId)

  if (state.completedResearch.includes(projectId)) {
    return { canResearch: false, reason: 'Already researched.' }
  }
  if (state.researchQueue !== undefined) {
    return { canResearch: false, reason: 'Research queue is busy — only one project at a time.' }
  }
  if (!state.buildings[def.requiredBuildingId]) {
    return { canResearch: false, reason: `Requires the ${getBuildingDef(def.requiredBuildingId).name} to be built.` }
  }
  const deficits = (Object.entries(def.cost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
  if (deficits.length > 0) {
    return { canResearch: false, reason: `Need ${deficits.join(', ')}.` }
  }

  return { canResearch: true }
}

const SCHOLAR_RESEARCH_SPEED_BONUS = 0.75

/** A Scholar assigned to the Research Institute speeds up whatever's queued (doc 03 — Scholar "Improves Library and Research Institute output"). Snapshotted at start time, same as every other duration in this codebase. */
export function getResearchDurationMs(state: GameState, projectId: string): number {
  const def = getResearchProjectDef(projectId)
  const hasResearchScholar = state.disciples.some((d) => d.role === 'Scholar' && d.assignedBuildingId === 'researchInstitute')
  return hasResearchScholar ? def.durationMs * SCHOLAR_RESEARCH_SPEED_BONUS : def.durationMs
}

/**
 * Resolves an in-progress research project once its timer elapses, adding
 * it to the permanent `completedResearch` list. Single-slot sweep — same
 * "sweep whatever's due" shape as resolveCompletedCrafting.
 */
export function resolveCompletedResearch(state: GameState, now: number): { state: GameState; projectCompleted?: string } {
  const queue = state.researchQueue
  if (queue === undefined || queue.endsAt > now) return { state }

  return {
    state: {
      ...state,
      completedResearch: [...state.completedResearch, queue.projectId],
      researchQueue: undefined,
    },
    projectCompleted: queue.projectId,
  }
}

/** +20% (per completed project) storage cap multiplier — pure lookup over completedResearch, no duplicated "unlocked" state. */
export function getResearchStorageCapMultiplier(state: GameState): number {
  return RESEARCH_PROJECT_DEFS.filter((p) => p.effect === 'storageCap' && state.completedResearch.includes(p.id)).reduce(
    (mult, p) => mult * (1 + (p.effectValue ?? 0)),
    1,
  )
}

/** Cultivation rate multiplier from completed research — pure lookup, no duplicated state. */
export function getResearchCultivationRateMultiplier(state: GameState): number {
  return RESEARCH_PROJECT_DEFS.filter(
    (p) => p.effect === 'cultivationRate' && state.completedResearch.includes(p.id),
  ).reduce((mult, p) => mult * (1 + (p.effectValue ?? 0)), 1)
}

/** Crafting duration multiplier for a given discipline — currently only Alchemy has a research hook (doc 10 §3 Alchemy is explicitly about pills/crafting speed). */
export function getResearchCraftingDurationMultiplier(state: GameState, discipline: CraftingRecipe['discipline']): number {
  return RESEARCH_PROJECT_DEFS.filter(
    (p) => p.effect === 'craftingSpeed' && p.category === discipline && state.completedResearch.includes(p.id),
  ).reduce((mult, p) => mult * (1 - (p.effectValue ?? 0)), 1)
}

/** Diplomatic action cost multiplier from completed research — mirrors getResearchCraftingDurationMultiplier's shape, closes the doc 10 Diplomacy branch's "no hook exists yet" note now that Wave 7 gives it one. */
export function getResearchDiplomacyCostMultiplier(state: GameState): number {
  return RESEARCH_PROJECT_DEFS.filter(
    (p) => p.effect === 'diplomacyCost' && state.completedResearch.includes(p.id),
  ).reduce((mult, p) => mult * (1 - (p.effectValue ?? 0)), 1)
}
