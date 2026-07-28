import type { SectDoctrineId } from '../types'

/** All multiplier fields default to 1 (no change) when absent — applied in engine/doctrine.ts. */
export interface DoctrineModifiers {
  productionMult?: number
  combatPowerMult?: number
  cultivationRateMult?: number
  knowledgeMult?: number
  /** Multiplies relationship gains from diplomatic actions (Wave 7). */
  relationshipGainMult?: number
  /** Divides the interval between world/narrative event rolls — >1 means events fire more often (Wave 7). */
  eventFrequencyMult?: number
}

export interface DoctrineDefinition {
  id: SectDoctrineId
  name: string
  belief: string
  effectsSummary: string
  modifiers: DoctrineModifiers
}

/**
 * doc 10 §11's 6 doctrines. Effects are modeled wherever a real numeric
 * hook exists: resource production, Combat Power, cultivation rate,
 * Knowledge, diplomatic relationship gain, and world/narrative event
 * frequency (the last two closed by Wave 7 — Diplomacy and Events now
 * exist). Recruitment cost/cooldown still has no hook and stays omitted
 * rather than faked, same precedent as the CP inputs `combatPower.ts`
 * already omits. Doctrine Evolution (doc 10 §12) is out of MVP scope.
 */
export const DOCTRINE_DEFS: DoctrineDefinition[] = [
  {
    id: 'strength',
    name: 'Doctrine of Strength',
    belief: 'Power above all.',
    effectsSummary: '+25% Combat Power, but -20% relationship gains from diplomacy.',
    modifiers: { combatPowerMult: 1.25, relationshipGainMult: 0.8 },
  },
  {
    id: 'harmony',
    name: 'Doctrine of Harmony',
    belief: 'Balance creates longevity.',
    effectsSummary: '+8% to production, Combat Power, and cultivation rate — moderate bonuses across all systems.',
    modifiers: { productionMult: 1.08, combatPowerMult: 1.08, cultivationRateMult: 1.08 },
  },
  {
    id: 'knowledge',
    name: 'Doctrine of Knowledge',
    belief: 'Wisdom surpasses force.',
    effectsSummary: '+50% Knowledge production, but -15% Combat Power — combat progression is slower.',
    modifiers: { knowledgeMult: 1.5, combatPowerMult: 0.85 },
  },
  {
    id: 'prosperity',
    name: 'Doctrine of Prosperity',
    belief: 'A wealthy sect is a powerful sect.',
    effectsSummary: '+30% resource production.',
    modifiers: { productionMult: 1.3 },
  },
  {
    id: 'discipline',
    name: 'Doctrine of Discipline',
    belief: 'Order above talent.',
    effectsSummary: '+15% resource production.',
    modifiers: { productionMult: 1.15 },
  },
  {
    id: 'freedom',
    name: 'Doctrine of Freedom',
    belief: 'Talent flourishes without restraint.',
    effectsSummary: '+25% cultivation rate and 50% more frequent world/narrative events.',
    modifiers: { cultivationRateMult: 1.25, eventFrequencyMult: 1.5 },
  },
]

export function getDoctrineDef(id: SectDoctrineId): DoctrineDefinition {
  const def = DOCTRINE_DEFS.find((d) => d.id === id)
  if (!def) throw new Error(`Unknown doctrine id: ${id}`)
  return def
}
