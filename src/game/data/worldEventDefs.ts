import type { Resources } from '../types'

export interface WorldEventDefinition {
  id: string
  name: string
  text: string
  durationMs: number
  /** Multiplies production for one resource while the event is active (doc 08 Section 10). */
  productionMult?: { resourceKey: keyof Resources; multiplier: number }
  /** Multiplies sect-wide cultivation rate while the event is active. */
  cultivationRateMult?: number
  /** Applied once, when the event resolves (its timer expires). */
  onResolve?: {
    reputationDelta?: number
    resourceDelta?: Partial<Resources>
    /** Grants one unit of an existing item def — reuses real content rather than inventing new items. */
    itemDefId?: string
    /** Flat relationship delta applied to every tracked faction at once. */
    relationshipDeltaAllFactions?: number
  }
}

/**
 * doc 08 Section 10's 5 named world events. Effects are bounded to systems
 * that genuinely exist today (production, cultivation rate, reputation,
 * relationship, a real item grant) — doc-described effects needing a
 * mission-generation or faction-competition system (recruitment bonuses,
 * "competition between factions", emergency missions, alliance
 * opportunities) are honestly omitted rather than faked, same precedent as
 * every prior wave's doctrine/mission substitutions. Combat Power is
 * deliberately untouched — threading a new modifier through
 * missions.ts/combatPower.ts for this stretch effect wasn't worth it at MVP
 * scope.
 */
export const WORLD_EVENT_DEFS: WorldEventDefinition[] = [
  {
    id: 'spiritBeastMigration',
    name: 'Spirit Beast Migration',
    text: 'Herds of spirit beasts are on the move through the region, keeping herb gatherers close to home.',
    durationMs: 45_000,
    productionMult: { resourceKey: 'spiritHerb', multiplier: 0.7 },
  },
  {
    id: 'greatTournament',
    name: 'Great Tournament',
    text: 'A Great Tournament draws cultivators from every nearby sect — a chance to be seen.',
    durationMs: 40_000,
    onResolve: { reputationDelta: 20 },
  },
  {
    id: 'ancientRuinAppears',
    name: 'Ancient Ruin Appears',
    text: 'An ancient ruin has emerged from the mountainside after centuries of silence.',
    durationMs: 30_000,
    onResolve: { itemDefId: 'qiReplenishmentPill' },
  },
  {
    id: 'heavenlyTribulationStorm',
    name: 'Heavenly Tribulation Storm',
    text: 'Lightning-wracked clouds gather overhead, making cultivation dangerous but rich in raw Qi.',
    durationMs: 40_000,
    cultivationRateMult: 0.75,
    onResolve: { resourceDelta: { qiStone: 30 } },
  },
  {
    id: 'demonicInvasion',
    name: 'Demonic Invasion',
    text: 'A demonic incursion tests every faction in the region, the sect included.',
    durationMs: 30_000,
    onResolve: { resourceDelta: { spiritStones: -50 }, relationshipDeltaAllFactions: -5 },
  },
]

export function getWorldEventDef(id: string): WorldEventDefinition {
  const def = WORLD_EVENT_DEFS.find((e) => e.id === id)
  if (!def) throw new Error(`Unknown world event id: ${id}`)
  return def
}
