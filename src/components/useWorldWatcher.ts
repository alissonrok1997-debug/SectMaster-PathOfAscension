import { useEffect } from 'react'
import { useGameStore } from '../game/state/store'
import type { GameState } from '../game/types'
import { getBuildingDef } from '../game/data/buildingDefs'
import { getResearchProjectDef } from '../game/data/researchProjectDefs'
import { publishCatchUp, publishToasts, type ToastEvent } from './toastChannel'

/**
 * Watches the store for outcomes the world produced on its own and publishes them to
 * `toastChannel` (§13). Presentation only — it reads state and never writes it, so no
 * engine, store, save or types change was needed for any of this.
 *
 * It subscribes to the store rather than running as a render effect: zustand hands the
 * listener both the next and previous snapshots, so there is no ref juggling, it fires
 * once per *store update* rather than once per render, and nothing re-renders because of
 * it. It lives in `components/` and not in `useGameLoop` because the loop is engine code.
 */

/** Only `tick` advances the sim clock, so anything else is a player action resolving now. */
function isWorldUpdate(next: GameState, prev: GameState): boolean {
  return next.simClock.totalElapsedMs > prev.simClock.totalElapsedMs
}

/**
 * Guard 3, and the one that actually matters. `applyOfflineCatchUp` runs inside
 * `initializeGame()` at module evaluation — before React mounts — so the *reload* path was
 * already safe. The real storm is phone sleep/wake: timers stop, the tab is never
 * reloaded, and one `tick` arrives carrying hours with no `offlineSummary` behind it.
 *
 * Measured on the sim clock rather than the wall clock, so a GC pause or a slow render
 * can never cost a legitimate toast — it measures how much *simulation* resolved.
 */
const NORMAL_DELTA_MS = 2_000 // 8 ticks — a render hitch never costs a legitimate toast.

function buildingKeys(state: GameState): Set<string> {
  return new Set(Object.values(state.buildings).map((b) => `${b.id}:${b.level}`))
}

function added<T>(next: Set<T>, prev: Set<T>): T[] {
  return [...next].filter((v) => !prev.has(v))
}

function diff(next: GameState, prev: GameState): ToastEvent[] {
  const events: ToastEvent[] = []

  /*
   * Missions: keyed on new entries in `missionLog`, NOT on `activeMissions` shrinking — a
   * recall shrinks the active list without an outcome, and would false-fire.
   *
   * Diffed by id rather than by length. Both logs are newest-first AND capped
   * (`MISSION_LOG_LIMIT` / `EXPEDITION_LOG_LIMIT`), so once the cap is reached the length
   * stops changing and a length diff would silently go blind for the rest of the run.
   */
  const prevMissionIds = new Set(prev.missionLog.map((m) => m.id))
  const newMissions = next.missionLog.filter((m) => !prevMissionIds.has(m.id))
  if (newMissions.length === 1) {
    const m = newMissions[0]
    const hurt = m.injuries.length > 0
    events.push({
      id: `mission:${m.id}`,
      title: m.missionName,
      line:
        m.outcome === 'Success'
          ? hurt
            ? `Returned. ${m.injuries[0].name} is hurt.`
            : 'The squad returns successful.'
          : 'The squad returns having failed.',
      severity: m.outcome === 'Success' ? (hurt ? 'injury' : 'gain') : 'fail',
      target: 'missions',
    })
  } else if (newMissions.length > 1) {
    events.push({
      id: `mission:batch:${next.simClock.totalElapsedMs}`,
      title: `${newMissions.length} squads return`,
      line: newMissions.map((m) => m.missionName).join(', '),
      severity: newMissions.some((m) => m.outcome === 'Failure') ? 'fail' : 'gain',
      target: 'missions',
    })
  }

  // Expeditions. `reports` growing is deliberately NOT its own event — missions.ts and
  // expeditions.ts are its only writers, so it always doubles something already firing.
  const prevExpeditionIds = new Set((prev.world?.expeditionLog ?? []).map((e) => e.id))
  const newExpeditions = (next.world?.expeditionLog ?? []).filter((e) => !prevExpeditionIds.has(e.id))
  if (newExpeditions.length === 1) {
    const e = newExpeditions[0]
    // `won` is player-centric regardless of which side they fought on (types.ts:759).
    const fought = e.battleResult !== undefined
    events.push({
      id: `expedition:${e.id}`,
      title: e.locationName,
      line: fought
        ? e.battleResult?.won
          ? 'The party returns victorious.'
          : 'The party returns beaten.'
        : 'The party returns.',
      severity: fought && !e.battleResult?.won ? 'fail' : e.incidents.length > 0 ? 'injury' : 'gain',
      target: 'world',
    })
  } else if (newExpeditions.length > 1) {
    events.push({
      id: `expedition:batch:${next.simClock.totalElapsedMs}`,
      title: `${newExpeditions.length} parties return`,
      line: newExpeditions.map((e) => e.locationName).join(', '),
      severity: 'gain',
      target: 'world',
    })
  }

  // Construction — keyed on id:level, so an upgrade counts as much as a first build.
  const builtNow = added(buildingKeys(next), buildingKeys(prev))
  if (builtNow.length > 0) {
    const [id, level] = builtNow[0].split(':')
    events.push({
      id: `building:${builtNow[0]}`,
      title: getBuildingDef(id).name,
      line: builtNow.length > 1 ? `Construction is finished, with ${builtNow.length - 1} more.` : `Level ${level} stands complete.`,
      severity: 'holding', // §2.2: gold is the player's own holdings.
      target: 'buildings',
    })
  }

  const researched = added(new Set(next.completedResearch), new Set(prev.completedResearch))
  if (researched.length > 0) {
    events.push({
      id: `research:${researched[0]}`,
      title: getResearchProjectDef(researched[0]).name,
      line: researched.length > 1 ? `Doctrine settled, with ${researched.length - 1} more.` : 'The doctrine is settled.',
      severity: 'doctrine', // Jade: this is cultivation knowledge, not a holding.
      target: 'research', // Step 12 renamed the *label* to Doctrine; the tab id is unchanged.
    })
  }

  /*
   * Death, and it is the loudest thing the channel can say. `resolveDownedDisciples` really
   * does remove them from the roster, so a row simply vanishes from a list — precisely the
   * event a player misses. It carries no target: there is nowhere useful to send them.
   * The sentence is BreakthroughOverlay's, verbatim; the game has one line for this.
   */
  const nextIds = new Set(next.disciples.map((d) => d.id))
  const gone = prev.disciples.filter((d) => !nextIds.has(d.id))
  if (gone.length > 0) {
    events.push({
      id: `death:${gone.map((d) => d.id).join(',')}`,
      title: gone.length === 1 ? gone[0].name : `${gone.length} disciples`,
      line: gone.length === 1 ? 'does not survive.' : 'do not survive.',
      severity: 'loss',
    })
  }

  return events
}

export function useWorldWatcher(): void {
  const offlineSummary = useGameStore((s) => s.offlineSummary)

  useEffect(() => {
    let baseline: GameState | undefined

    return useGameStore.subscribe((store, prevStore) => {
      const next = store.state
      const prev = baseline ?? prevStore.state

      // Guard 1: baseline on the first sample and emit nothing, so the very first observed
      // update can never be mistaken for news (the `useValueFlash` precedent, step 9).
      if (!baseline) {
        baseline = next
        return
      }
      baseline = next

      if (!isWorldUpdate(next, prev)) return

      // Guard 2: the welcome-back sheet owns the return-from-away moment, exclusively.
      if (useGameStore.getState().offlineSummary !== null) return

      const delta = next.simClock.totalElapsedMs - prev.simClock.totalElapsedMs
      const events = diff(next, prev)
      if (events.length === 0) return

      if (delta > NORMAL_DELTA_MS) {
        // A backgrounded tab or a woken phone resolved a chunk of simulation at once.
        // One notice, not a queue: past ~8 ticks the player wasn't watching, so the honest
        // report is a count and a pointer at the Chronicle.
        publishCatchUp(events.length)
      } else {
        publishToasts(events)
      }
    })
  }, [offlineSummary])
}
