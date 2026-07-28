import type { DiplomaticActionId, Resources } from '../types'

export interface DiplomaticActionDefinition {
  id: DiplomaticActionId
  name: string
  description: string
  cost: Partial<Resources>
  /** Positive = relationship improves, negative = it worsens. Positive gains are capped (see `RELATIONSHIP_CAP_WITHOUT_ALLIANCE` in engine/diplomacy.ts) since Alliance/Non-Aggression Pact don't exist to unlock the top two tiers. */
  relationshipDelta: number
  cooldownMs: number
  /** One-time resource grant alongside the relationship delta — an honest substitution for a doc-stated benefit that needs a system that doesn't exist yet (see each entry below). */
  bonusGrant?: Partial<Resources>
}

/**
 * doc 08 Section 7's 6 diplomatic actions, minus Alliance and Non-Aggression
 * Pact (both omitted — see types.ts's DiplomaticActionId comment). Every
 * shipped action maps to a real, honest effect today: Tribute/Refusal are
 * exactly what the doc describes; Knowledge Exchange and Trade Agreement
 * substitute their doc-stated benefits (manuals/research, better prices —
 * neither has a system to hook into yet) with a direct resource grant,
 * same substitution precedent as Wave 4's mission-reward swaps.
 */
export const DIPLOMATIC_ACTION_DEFS: DiplomaticActionDefinition[] = [
  {
    id: 'tribute',
    name: 'Tribute',
    description: 'Offer resources to improve relations.',
    cost: { spiritStones: 50 },
    relationshipDelta: 15,
    cooldownMs: 30_000,
  },
  {
    id: 'refusal',
    name: 'Refusal',
    description: "Decline a faction's request outright — free, but relations sour.",
    cost: {},
    relationshipDelta: -12,
    cooldownMs: 15_000,
  },
  {
    id: 'knowledgeExchange',
    name: 'Knowledge Exchange',
    description:
      'Trade insights for goodwill, gaining Knowledge in the exchange.',
    cost: { spiritStones: 45 },
    relationshipDelta: 10,
    cooldownMs: 35_000,
    bonusGrant: { knowledge: 20 },
  },
  {
    id: 'tradeAgreement',
    name: 'Trade Agreement',
    description:
      'Formalize trade terms, earning a one-time signing bonus.',
    cost: { spiritStones: 70 },
    relationshipDelta: 8,
    cooldownMs: 40_000,
    bonusGrant: { spiritStones: 25 },
  },
]

export function getDiplomaticActionDef(id: DiplomaticActionId): DiplomaticActionDefinition {
  const def = DIPLOMATIC_ACTION_DEFS.find((a) => a.id === id)
  if (!def) throw new Error(`Unknown diplomatic action id: ${id}`)
  return def
}
