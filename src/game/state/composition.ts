import type { GameState, SectState, WorldState } from '../types'

/**
 * The seam between one sect's private state and the realm it plays in (MULTIPLAYER_PLAN §1).
 *
 * Single-player holds the two composed and never thinks about it — `GameState` *is*
 * `SectState & { world }`, so the split cost no call sites. A server cannot: it stores one
 * `WorldState` per realm and one `SectState` per player, composes them to run a pure engine
 * function, then writes each half back to its own row.
 *
 * These two functions are that boundary, and they exist now rather than at Wave 3 so the shape is
 * settled while there is still exactly one sect to get it wrong with.
 */

/** Compose a sect's private state with the shared realm into the shape engine functions take. */
export function composeState(sect: SectState, world: WorldState | undefined): GameState {
  return { ...sect, world }
}

/**
 * Tear a composed state back into the two halves a server persists separately.
 *
 * `world` is undefined pre-founding — a sect that has not joined a realm yet has no realm to write
 * back. Callers that know a sect is founded can assert it; nothing here does, because an unfounded
 * sect is a real state the app boots into.
 */
export function splitState(state: GameState): { sect: SectState; world: WorldState | undefined } {
  const { world, ...sect } = state
  return { sect, world }
}

/**
 * Apply a pure engine transition for one sect against a shared realm, returning both halves.
 *
 * This is the shape a server request handler wants: load two rows, run one rule, write two rows.
 * Keeping it here means the engine never learns that storage is split — it keeps taking `GameState`,
 * which is what makes the whole conversion a transport change rather than a rules change.
 */
export function applyForSect<A extends unknown[]>(
  sect: SectState,
  world: WorldState | undefined,
  transition: (state: GameState, ...args: A) => GameState,
  ...args: A
): { sect: SectState; world: WorldState | undefined } {
  return splitState(transition(composeState(sect, world), ...args))
}
