import type { GameState } from '../types'
import { DOCTRINE_DEFS, type DoctrineModifiers } from '../data/doctrineDefs'

export interface ResolvedDoctrineModifiers {
  productionMult: number
  combatPowerMult: number
  cultivationRateMult: number
  knowledgeMult: number
  relationshipGainMult: number
  eventFrequencyMult: number
}

const DEFAULT_MODIFIERS: ResolvedDoctrineModifiers = {
  productionMult: 1,
  combatPowerMult: 1,
  cultivationRateMult: 1,
  knowledgeMult: 1,
  relationshipGainMult: 1,
  eventFrequencyMult: 1,
}

/**
 * Single source of truth for the sect's current Doctrine multipliers (doc
 * 10 §11) — defaults to no change at all until a Doctrine is chosen.
 * Consumed by production/cultivation/combatPower/missions so a Doctrine
 * choice measurably changes sect behavior, per Wave 6's exit condition.
 */
export function getDoctrineModifiers(state: GameState): ResolvedDoctrineModifiers {
  if (!state.doctrine) return DEFAULT_MODIFIERS
  const def = DOCTRINE_DEFS.find((d) => d.id === state.doctrine)
  if (!def) return DEFAULT_MODIFIERS
  return { ...DEFAULT_MODIFIERS, ...(def.modifiers as DoctrineModifiers) }
}
