import type { CombatReportEntry, GameState } from '../../types'

/** Newest-first cap on the Combat Report Inbox — a few tens of KB at 100 entries (§4.7: outcome + seed only). */
export const REPORT_INBOX_LIMIT = 100

/**
 * Newest-first insert + trim. Entries arrive already built by the resolver that
 * owns the fight; a single tick can resolve several fights at once (exactly as
 * `resolveCompletedMissions` batches `logEntries`), so the incoming batch is
 * sorted newest-first before prepending. Pure — takes `GameState`, returns `GameState`.
 */
export function deliverReports(state: GameState, entries: CombatReportEntry[]): GameState {
  if (entries.length === 0) return state
  const batch = [...entries].sort((a, b) => b.resolvedAt - a.resolvedAt)
  const reports = [...batch, ...state.reports].slice(0, REPORT_INBOX_LIMIT)
  return { ...state, reports }
}

/** Player action — mark one report read. A saved-state transition, so it lives in the engine, not the store. */
export function markReportRead(state: GameState, id: string): GameState {
  if (!state.reports.some((r) => r.id === id && !r.read)) return state
  return { ...state, reports: state.reports.map((r) => (r.id === id ? { ...r, read: true } : r)) }
}

/** Player action — mark every report read, clearing the unread badge. */
export function markAllReportsRead(state: GameState): GameState {
  if (state.reports.every((r) => r.read)) return state
  return { ...state, reports: state.reports.map((r) => (r.read ? r : { ...r, read: true })) }
}
