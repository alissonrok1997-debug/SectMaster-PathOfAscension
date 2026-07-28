import type { EventLogEntry, GameState, Resources } from '../types'
import { WORLD_EVENT_DEFS, getWorldEventDef } from '../data/worldEventDefs'
import { grantItemToInventory } from './crafting'
import { applyReputationDelta } from './factions'
import { getDoctrineModifiers } from './doctrine'

/** Cadence between world events — once per real day (24h) — divided by Freedom doctrine's eventFrequencyMult when chosen. */
const BASE_WORLD_EVENT_INTERVAL_MS = 86_400_000

const EVENT_LOG_LIMIT = 10

function rollNextWorldEventAt(state: GameState, now: number): number {
  const mult = getDoctrineModifiers(state).eventFrequencyMult
  return now + BASE_WORLD_EVENT_INTERVAL_MS / mult
}

export interface WorldEventModifiers {
  productionMult: Partial<Record<keyof Resources, number>>
  cultivationRateMult: number
}

/** Active world event's live modifiers — defaults to no change when none is active. Consumed by production.ts/cultivation.ts. */
export function getWorldEventModifiers(state: GameState): WorldEventModifiers {
  if (!state.worldEvent) return { productionMult: {}, cultivationRateMult: 1 }
  const def = getWorldEventDef(state.worldEvent.defId)
  const productionMult: Partial<Record<keyof Resources, number>> = {}
  if (def.productionMult) productionMult[def.productionMult.resourceKey] = def.productionMult.multiplier
  return { productionMult, cultivationRateMult: def.cultivationRateMult ?? 1 }
}

/**
 * Triggers a new world event when the slot is free and due, and resolves
 * the active one once its timer elapses — folded into one sweep, same
 * "trigger-and-resolve together" shape as resolveMissionBoardRefresh.
 */
export function resolveWorldEventLifecycle(state: GameState, now: number): { state: GameState; logEntry?: EventLogEntry } {
  if (state.worldEvent !== undefined) {
    if (state.worldEvent.endsAt > now) return { state }
    return resolveActiveWorldEvent(state, now)
  }

  if (state.nextWorldEventAt > now) return { state }

  const def = WORLD_EVENT_DEFS[Math.floor(Math.random() * WORLD_EVENT_DEFS.length)]
  return {
    state: { ...state, worldEvent: { defId: def.id, startedAt: now, endsAt: now + def.durationMs } },
  }
}

function resolveActiveWorldEvent(state: GameState, now: number): { state: GameState; logEntry: EventLogEntry } {
  const active = state.worldEvent!
  const def = getWorldEventDef(active.defId)

  let resources = state.resources
  let reputation = state.reputation
  let items = state.items
  let factionRelationships = state.factionRelationships

  if (def.onResolve?.resourceDelta) {
    const next = { ...resources }
    for (const [key, amount] of Object.entries(def.onResolve.resourceDelta) as [keyof Resources, number][]) {
      next[key] = Math.max(0, next[key] + amount)
    }
    resources = next
  }
  if (def.onResolve?.reputationDelta) {
    reputation = applyReputationDelta(reputation, def.onResolve.reputationDelta)
  }
  if (def.onResolve?.itemDefId) {
    items = grantItemToInventory(items, def.onResolve.itemDefId)
  }
  if (def.onResolve?.relationshipDeltaAllFactions) {
    const delta = def.onResolve.relationshipDeltaAllFactions
    const next = { ...factionRelationships }
    for (const id of Object.keys(next)) {
      next[id] = Math.max(-100, Math.min(100, next[id] + delta))
    }
    factionRelationships = next
  }

  const logEntry: EventLogEntry = {
    id: crypto.randomUUID(),
    source: 'world',
    defId: def.id,
    name: def.name,
    text: def.text,
    resolvedAt: now,
  }

  return {
    state: {
      ...state,
      resources,
      reputation,
      items,
      factionRelationships,
      worldEvent: undefined,
      nextWorldEventAt: rollNextWorldEventAt(state, now),
      eventLog: [logEntry, ...state.eventLog].slice(0, EVENT_LOG_LIMIT),
    },
    logEntry,
  }
}
