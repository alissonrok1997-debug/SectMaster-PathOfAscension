import type { EventLogEntry, GameState, Resources } from '../types'
import { EVENT_DEFS, getEventDef } from '../data/eventDefs'
import { applyReputationDelta } from './factions'
import { getDoctrineModifiers } from './doctrine'
import { RELATIONSHIP_CAP_WITHOUT_ALLIANCE } from './diplomacy'

/** Minimum gap between narrative event rolls (30 min) — divided by Freedom doctrine's eventFrequencyMult when chosen. */
const BASE_EVENT_INTERVAL_MS = 1_800_000

const EVENT_LOG_LIMIT = 10

function rollNextEventAt(state: GameState, now: number): number {
  const mult = getDoctrineModifiers(state).eventFrequencyMult
  return now + BASE_EVENT_INTERVAL_MS / mult
}

function applyResourceDelta(resources: Resources, delta: Partial<Resources> | undefined): Resources {
  if (!delta) return resources
  const next = { ...resources }
  for (const [key, amount] of Object.entries(delta) as [keyof Resources, number][]) {
    next[key] = Math.max(0, next[key] + amount)
  }
  return next
}

/**
 * Rolls a new pending event once the slot is free and due (doc 05 §3
 * Random Pool source). Automatic events resolve immediately into the event
 * log; Decision events sit pending until resolveEventChoice is called —
 * this is what "paused until the player returns" (doc 05 §2) means at MVP
 * scope: nothing else about the sim pauses, only the next event roll
 * waits.
 */
export function resolveEventLifecycle(state: GameState, now: number): { state: GameState; logEntry?: EventLogEntry } {
  if (state.pendingEvent !== undefined) return { state }
  if (state.nextEventAt > now) return { state }

  const def = EVENT_DEFS[Math.floor(Math.random() * EVENT_DEFS.length)]

  if (def.kind === 'decision') {
    return { state: { ...state, pendingEvent: { defId: def.id, triggeredAt: now } } }
  }

  const resources = applyResourceDelta(state.resources, def.autoEffect?.resourceDelta)
  const reputation = applyReputationDelta(state.reputation, def.autoEffect?.reputationDelta ?? 0)
  const logEntry: EventLogEntry = {
    id: crypto.randomUUID(),
    source: 'narrative',
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
      nextEventAt: rollNextEventAt(state, now),
      eventLog: [logEntry, ...state.eventLog].slice(0, EVENT_LOG_LIMIT),
    },
    logEntry,
  }
}

/** Applies the chosen consequence for the pending Decision Event and clears the slot. No-op (returns `state` unchanged) if nothing is pending or the index is invalid. */
export function resolveEventChoice(state: GameState, choiceIndex: number, now: number): GameState {
  const pending = state.pendingEvent
  if (!pending) return state
  const def = getEventDef(pending.defId)
  if (def.kind !== 'decision' || !def.choices) return state
  const choice = def.choices[choiceIndex]
  if (!choice) return state

  const resources = applyResourceDelta(state.resources, choice.resourceDelta)
  const reputation = applyReputationDelta(state.reputation, choice.reputationDelta ?? 0)
  const disciples =
    choice.loyaltyDeltaAllDisciples !== undefined
      ? state.disciples.map((d) => ({
          ...d,
          loyalty: Math.max(0, Math.min(100, d.loyalty + choice.loyaltyDeltaAllDisciples!)),
        }))
      : state.disciples

  let factionRelationships = state.factionRelationships
  if (choice.relationshipDelta) {
    const { factionId, amount } = choice.relationshipDelta
    const current = factionRelationships[factionId] ?? 0
    let next = Math.max(-100, Math.min(100, current + amount))
    if (amount > 0) next = Math.min(next, RELATIONSHIP_CAP_WITHOUT_ALLIANCE)
    factionRelationships = { ...factionRelationships, [factionId]: next }
  }

  const logEntry: EventLogEntry = {
    id: crypto.randomUUID(),
    source: 'narrative',
    defId: def.id,
    name: def.name,
    text: `${def.text} Chose: "${choice.label}."`,
    resolvedAt: now,
  }

  return {
    ...state,
    resources,
    reputation,
    disciples,
    factionRelationships,
    pendingEvent: undefined,
    nextEventAt: rollNextEventAt(state, now),
    eventLog: [logEntry, ...state.eventLog].slice(0, EVENT_LOG_LIMIT),
  }
}
