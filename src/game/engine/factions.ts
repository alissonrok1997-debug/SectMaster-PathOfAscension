import type { RelationshipTierName, ReputationTierName } from '../types'

interface Tier<T extends string> {
  name: T
  min: number
}

/** doc 08 §6's 7-tier ladder over a -100..100 relationship value. */
const RELATIONSHIP_TIERS: Tier<RelationshipTierName>[] = [
  { name: 'Sworn Enemy', min: -100 },
  { name: 'Hostile', min: -74 },
  { name: 'Suspicious', min: -39 },
  { name: 'Neutral', min: -9 },
  { name: 'Friendly', min: 10 },
  { name: 'Trusted Ally', min: 40 },
  { name: 'Strategic Partner', min: 75 },
]

/** doc 08 §8's reputation examples (Famous/Infamous/Respected), extended into a full symmetric ladder over a -100..100 value. */
const REPUTATION_TIERS: Tier<ReputationTierName>[] = [
  { name: 'Infamous', min: -100 },
  { name: 'Unknown', min: -29 },
  { name: 'Respected', min: 30 },
  { name: 'Famous', min: 60 },
  { name: 'Legendary', min: 90 },
]

function resolveTier<T extends string>(tiers: Tier<T>[], value: number): T {
  let current = tiers[0]
  for (const tier of tiers) {
    if (value >= tier.min) current = tier
  }
  return current.name
}

/** Derives the doc 08 §6 relationship tier from a numeric value — never stored directly, mirrors how Sect Rank derives from Hall level. */
export function getRelationshipTier(value: number): RelationshipTierName {
  return resolveTier(RELATIONSHIP_TIERS, value)
}

/** Derives the doc 08 §8 reputation tier from the sect's global reputation value. */
export function getReputationTier(value: number): ReputationTierName {
  return resolveTier(REPUTATION_TIERS, value)
}

export function applyRelationshipDelta(current: number, delta: number): number {
  return Math.max(-100, Math.min(100, current + delta))
}

export function applyReputationDelta(current: number, delta: number): number {
  return Math.max(-100, Math.min(100, current + delta))
}
