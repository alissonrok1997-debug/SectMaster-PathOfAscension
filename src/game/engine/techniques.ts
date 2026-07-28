import type { DiscipleInstance, GameState } from '../types'
import { getTechniqueDef, TECHNIQUE_DEFS, type TechniqueDefinition } from '../data/techniqueDefs'
import { getItemDef } from '../data/itemDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'
import type { Resources } from '../types'

/** A technique is "discovered" once the research project that names it as `unlocksTechniqueId` has completed — no separate discovered-state array, mirrors how Sect Rank derives purely from Hall level. */
export function isTechniqueDiscovered(state: GameState, techniqueId: string): boolean {
  return state.completedResearch.includes(getTechniqueDef(techniqueId).requiredResearchId)
}

export function getDiscoveredTechniques(state: GameState): TechniqueDefinition[] {
  return TECHNIQUE_DEFS.filter((t) => isTechniqueDiscovered(state, t.id))
}

export interface TeachEligibility {
  canTeach: boolean
  reason?: string
}

/** Single source of truth for whether a disciple can be taught a technique — shared by the Disciple Card UI and the store guard, same pattern as getCraftEligibility. */
export function getTeachEligibility(state: GameState, discipleId: string, techniqueId: string): TeachEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { canTeach: false, reason: 'Disciple not found.' }

  const def = getTechniqueDef(techniqueId)

  if (!isTechniqueDiscovered(state, techniqueId)) {
    return { canTeach: false, reason: 'Not yet discovered through research.' }
  }
  if (disciple.knownTechniques.includes(techniqueId)) {
    return { canTeach: false, reason: 'Already known.' }
  }
  if (disciple.learningTechniqueId !== undefined) {
    return { canTeach: false, reason: 'Already learning a technique.' }
  }
  if (disciple.awayUntil !== undefined) {
    return { canTeach: false, reason: `${disciple.name} is away.` }
  }
  if (def.requiredItemDefId) {
    const stock = state.items.find((i) => i.itemId === def.requiredItemDefId)?.quantity ?? 0
    if (stock <= 0) {
      return { canTeach: false, reason: `Requires a ${getItemDef(def.requiredItemDefId).name}.` }
    }
  }
  const deficits = (Object.entries(def.teachCost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
  if (deficits.length > 0) {
    return { canTeach: false, reason: `Need ${deficits.join(', ')}.` }
  }

  return { canTeach: true }
}

export interface TeachingCompletion {
  discipleName: string
  techniqueName: string
}

/**
 * Resolves any disciple whose teaching timer has elapsed: adds the
 * technique to their known list and clears the timer. Roster-wide sweep —
 * mirrors resolveCompletedMissions's plural "sweep whatever's due" shape,
 * since teaching (unlike research/crafting) isn't a single sect-wide slot.
 */
export function resolveCompletedTeaching(
  disciples: DiscipleInstance[],
  now: number,
): { disciples: DiscipleInstance[]; completions: TeachingCompletion[] } {
  const completions: TeachingCompletion[] = []
  let changed = false

  const next = disciples.map((disciple) => {
    if (disciple.learningTechniqueId === undefined || disciple.learningTechniqueUntil === undefined) return disciple
    if (disciple.learningTechniqueUntil > now) return disciple

    const techniqueId = disciple.learningTechniqueId
    completions.push({ discipleName: disciple.name, techniqueName: getTechniqueDef(techniqueId).name })
    changed = true
    return {
      ...disciple,
      knownTechniques: [...disciple.knownTechniques, techniqueId],
      learningTechniqueId: undefined,
      learningTechniqueUntil: undefined,
    }
  })

  return { disciples: changed ? next : disciples, completions }
}

/** Flat CP bonus from every known technique (doc 06 §2's documented-but-omitted Techniques CP input, now real). */
export function getTechniqueCombatPowerBonus(disciple: DiscipleInstance): number {
  return disciple.knownTechniques.reduce((sum, id) => sum + getTechniqueDef(id).combatPowerBonus, 0)
}
