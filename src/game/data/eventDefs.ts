import type { Resources } from '../types'

export interface EventChoice {
  label: string
  description: string
  resourceDelta?: Partial<Resources>
  loyaltyDeltaAllDisciples?: number
  reputationDelta?: number
  /** Only used by events explicitly about one named faction. */
  relationshipDelta?: { factionId: string; amount: number }
}

export interface EventDefinition {
  id: string
  kind: 'automatic' | 'decision'
  name: string
  text: string
  /** Automatic only — applied immediately on trigger, no player input. */
  autoEffect?: { resourceDelta?: Partial<Resources>; reputationDelta?: number }
  /** Decision only — 2-3 choices (doc 05 Section 12). */
  choices?: EventChoice[]
}

/**
 * MVP narrative event pool (doc 05 Section 12): Automatic Events (basic
 * pool), Decision Events with 2-3 choices, consequences on resources/
 * loyalty/reputation. Random Pool source only (doc 05 Section 3) —
 * Disciple/Mission/Sect-Milestone sources would each need bespoke trigger
 * wiring the doc's own MVP section doesn't require ("world-driven
 * large-scale events can initially reuse World System's basic events" — see
 * worldEventDefs.ts for that half). "A Disciple's Doubt" is doc 05 Section
 * 4's own worked example, applied sect-wide rather than to one named
 * disciple since there's no per-disciple event-targeting system yet.
 */
export const EVENT_DEFS: EventDefinition[] = [
  {
    id: 'travelingMerchant',
    kind: 'automatic',
    name: 'A Traveling Merchant Visits',
    text: 'A traveling merchant passes through, trades a few odds and ends, and moves on.',
    autoEffect: { resourceDelta: { spiritStones: 25 } },
  },
  {
    id: 'minorHarvestBonus',
    kind: 'automatic',
    name: 'A Minor Harvest Bonus',
    text: 'Favorable weather leaves the outer gardens unusually full this week.',
    autoEffect: { resourceDelta: { spiritHerb: 20 } },
  },
  {
    id: 'weatherTurnsFair',
    kind: 'automatic',
    name: 'Weather Turns Fair',
    text: 'Clear skies settle over the mountain for a few days — nothing to act on, just a pleasant stretch.',
  },
  {
    id: 'disciplesDoubt',
    kind: 'decision',
    name: "A Disciple's Doubt",
    text: "Whispers spread through the dormitory: a disciple has been openly questioning whether the sect's harsh training is worth the cost.",
    choices: [
      {
        label: 'Reassure them personally',
        description: 'Loyalty rises across the sect.',
        loyaltyDeltaAllDisciples: 5,
      },
      {
        label: 'Grant everyone a day of rest',
        description: "Spends resources on the sect's comfort; loyalty rises modestly.",
        resourceDelta: { spiritStones: -20 },
        loyaltyDeltaAllDisciples: 3,
      },
      {
        label: 'Dismiss the concerns',
        description: 'Loyalty falls, but the sect is seen as unwavering.',
        loyaltyDeltaAllDisciples: -6,
        reputationDelta: 3,
      },
    ],
  },
  {
    id: 'neighboringSectRequestsAid',
    kind: 'decision',
    name: 'A Neighboring Sect Requests Aid',
    text: 'A messenger from the Azure Dawn Sect asks for help against marauding spirit beasts.',
    choices: [
      {
        label: 'Send aid',
        description: "Costs resources, but relations improve and word spreads of the sect's generosity.",
        resourceDelta: { spiritHerb: -20, spiritStones: -20 },
        relationshipDelta: { factionId: 'azureDawnSect', amount: 12 },
        reputationDelta: 5,
      },
      {
        label: 'Decline',
        description: 'No cost, but relations sour.',
        relationshipDelta: { factionId: 'azureDawnSect', amount: -8 },
      },
    ],
  },
]

export function getEventDef(id: string): EventDefinition {
  const def = EVENT_DEFS.find((e) => e.id === id)
  if (!def) throw new Error(`Unknown event id: ${id}`)
  return def
}
