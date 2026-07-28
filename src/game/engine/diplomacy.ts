import type { DiplomaticActionId, GameState, Resources } from '../types'
import { getDiplomaticActionDef } from '../data/diplomaticActionDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'
import { applyRelationshipDelta } from './factions'
import { getDoctrineModifiers } from './doctrine'
import { getResearchDiplomacyCostMultiplier } from './research'

/**
 * Alliance and Non-Aggression Pact are out of MVP scope (doc 08 §7) — their
 * benefits need a conflict/mission-sharing system that doesn't exist until
 * Wave 9. Without them, relationship gains from the 4 shipped actions are
 * capped just below Trusted Ally, so the top two tiers stay genuinely
 * locked behind future content rather than grindable via Tribute alone
 * (confirmed with the user).
 */
export const RELATIONSHIP_CAP_WITHOUT_ALLIANCE = 39

export interface DiplomaticActionEligibility {
  canPerform: boolean
  reason?: string
  cost: Partial<Resources>
}

/** Single source of truth for whether a diplomatic action can be performed — shared by the World Panel and the store guard, same pattern as getResearchEligibility. */
export function getDiplomaticActionEligibility(
  state: GameState,
  factionId: string,
  actionId: DiplomaticActionId,
): DiplomaticActionEligibility {
  const def = getDiplomaticActionDef(actionId)
  const costMultiplier = getResearchDiplomacyCostMultiplier(state)
  const cost: Partial<Resources> = {}
  for (const [key, amount] of Object.entries(def.cost) as [keyof Resources, number][]) {
    cost[key] = Math.round(amount * costMultiplier)
  }

  const cooldownKey = `${factionId}:${actionId}`
  const cooldownUntil = state.diplomaticActionCooldowns[cooldownKey]
  if (cooldownUntil !== undefined && cooldownUntil > Date.now()) {
    return { canPerform: false, reason: 'On cooldown with this faction.', cost }
  }

  if (def.relationshipDelta > 0) {
    const current = state.factionRelationships[factionId] ?? 0
    if (current >= RELATIONSHIP_CAP_WITHOUT_ALLIANCE) {
      return { canPerform: false, reason: 'Relationship capped without a real Alliance system (Wave 9).', cost }
    }
  }

  const deficits = (Object.entries(cost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
  if (deficits.length > 0) {
    return { canPerform: false, reason: `Need ${deficits.join(', ')}.`, cost }
  }

  return { canPerform: true, cost }
}

/** Instant resolution + per-faction-per-action cooldown — matches an action's real-world instant-ness better than forcing it into the single-slot timed-queue pattern. Returns `state` unchanged (same reference) if ineligible. */
export function applyDiplomaticAction(
  state: GameState,
  factionId: string,
  actionId: DiplomaticActionId,
  now: number,
): GameState {
  const eligibility = getDiplomaticActionEligibility(state, factionId, actionId)
  if (!eligibility.canPerform) return state

  const def = getDiplomaticActionDef(actionId)
  const resources = { ...state.resources }
  for (const [key, amount] of Object.entries(eligibility.cost) as [keyof Resources, number][]) {
    resources[key] -= amount
  }
  if (def.bonusGrant) {
    for (const [key, amount] of Object.entries(def.bonusGrant) as [keyof Resources, number][]) {
      resources[key] += amount
    }
  }

  const relationshipMult = def.relationshipDelta > 0 ? getDoctrineModifiers(state).relationshipGainMult : 1
  const current = state.factionRelationships[factionId] ?? 0
  let nextValue = applyRelationshipDelta(current, def.relationshipDelta * relationshipMult)
  if (def.relationshipDelta > 0) nextValue = Math.min(nextValue, RELATIONSHIP_CAP_WITHOUT_ALLIANCE)

  return {
    ...state,
    resources,
    factionRelationships: { ...state.factionRelationships, [factionId]: nextValue },
    diplomaticActionCooldowns: {
      ...state.diplomaticActionCooldowns,
      [`${factionId}:${actionId}`]: now + def.cooldownMs,
    },
  }
}
