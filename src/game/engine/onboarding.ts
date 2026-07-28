import type { GameState } from '../types'

/** First Five / First Thirty Minutes objectives (doc 11 Sections 4-5), derived from real GameState — never a separately stored tutorial-step flag. */
export interface OnboardingObjective {
  id: string
  label: string
  isComplete: boolean
}

export function getOnboardingObjectives(state: GameState): OnboardingObjective[] {
  return [
    {
      id: 'firstProductionBuilding',
      label: 'Upgrade a production building',
      isComplete: Object.values(state.buildings).some((b) => b.category === 'Production' && b.level > 1),
    },
    {
      id: 'firstDisciple',
      label: 'Recruit a disciple',
      isComplete: state.disciples.length > 0,
    },
    {
      id: 'firstMission',
      label: 'Send a disciple on a mission',
      isComplete: state.activeMissions.length > 0 || state.missionLog.length > 0,
    },
    {
      id: 'firstResearch',
      label: 'Begin a research project',
      isComplete: state.researchQueue !== undefined || state.completedResearch.length > 0,
    },
    {
      id: 'firstItem',
      label: 'Craft your first item',
      isComplete: state.items.length > 0,
    },
    {
      id: 'firstEquip',
      label: 'Equip an item on a disciple',
      isComplete: state.disciples.some((d) => Object.values(d.equipment).some((slot) => slot !== undefined)),
    },
    {
      id: 'firstEvent',
      label: 'Resolve an event',
      isComplete: state.eventLog.length > 0,
    },
  ]
}

export function isOnboardingComplete(objectives: OnboardingObjective[]): boolean {
  return objectives.every((o) => o.isComplete)
}
