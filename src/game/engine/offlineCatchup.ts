import type { EventLogEntry, GameState, MissionLogEntry, Resources } from '../types'
import { createEmptyResources } from '../types'
import { getBuildingDef } from '../data/buildingDefs'
import { resolveCompletedConstruction } from './construction'
import { applyProductionTick } from './production'
import { applyCultivationTick } from './cultivation'
import { resolveCompletedMissions } from './missions'
import { resolveCompletedCrafting } from './crafting'
import { getItemDisplayName } from './itemQuality'
import { resolveCompletedResearch } from './research'
import { getResearchProjectDef } from '../data/researchProjectDefs'
import { resolveCompletedTeaching, type TeachingCompletion } from './techniques'
import { resolveCompletedTerritoryClaim } from './territories'
import { getTerritoryDef } from '../data/territoryDefs'
import { resolveWorldEventLifecycle } from './worldEvents'
import { resolveEventLifecycle } from './events'

/** Offline Time Cap (doc 09, Section 5) — the recommended MVP default. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000

/** Simulate in bounded chunks rather than one giant tick, so multiple breakthroughs can resolve across a long gap instead of just one. */
const CATCHUP_CHUNK_MS = 10_000

/** Below this, don't bother showing a summary — avoids a "welcome back" popup for a same-session reload. */
const MIN_GAP_TO_REPORT_MS = 2_000

export interface OfflineSummary {
  elapsedMs: number
  cappedMs: number
  wasCapped: boolean
  resourceGains: Partial<Resources>
  buildingsCompleted: string[]
  discipleBreakthroughs: { name: string; fromRealm: string; toRealm: string }[]
  injuriesRecovered: string[]
  disciplesReturned: string[]
  missionOutcomes: MissionLogEntry[]
  itemsCrafted: string[]
  researchCompleted: string[]
  techniquesTaught: TeachingCompletion[]
  territoriesClaimed: string[]
  worldEventsResolved: EventLogEntry[]
  narrativeEventsResolved: EventLogEntry[]
  /** Set only when the calendar day advanced since the last login (doc 11 Section 19) — independent of how long the offline gap itself was. */
  loginStreakBonus?: { streakDay: number; resourceGains: Partial<Resources> }
}

/** An all-empty summary shell, for when the only thing worth reporting on this load is the login streak (e.g. a same-second reload just after midnight, where the offline gap itself is too short to report on its own). */
export function emptyOfflineSummary(): OfflineSummary {
  return {
    elapsedMs: 0,
    cappedMs: 0,
    wasCapped: false,
    resourceGains: {},
    buildingsCompleted: [],
    discipleBreakthroughs: [],
    injuriesRecovered: [],
    disciplesReturned: [],
    missionOutcomes: [],
    itemsCrafted: [],
    researchCompleted: [],
    techniquesTaught: [],
    territoriesClaimed: [],
    worldEventsResolved: [],
    narrativeEventsResolved: [],
  }
}

/**
 * Offline Simulation Rules (doc 09, Sections 4-5, 14). Runs the same
 * production/cultivation/construction math the live tick uses, in bounded
 * chunks, for however long the player was away — capped at 8 hours.
 *
 * Anti-exploit (doc 09, Section 14): elapsed time is clamped to >= 0, so a
 * clock moved backward can't produce negative-time weirdness, and it's
 * capped at OFFLINE_CAP_MS, so moving the clock forward grants no more
 * than the same reward a normal 8-hour absence would. The caller is
 * responsible for persisting the returned state (with its bumped
 * `lastSavedAt`) right away, so a second reload moments later sees an
 * already-closed window instead of reprocessing the same gap.
 */
export function applyOfflineCatchUp(state: GameState): { state: GameState; summary: OfflineSummary | null } {
  const now = Date.now()
  const elapsedMs = Math.max(0, now - state.lastSavedAt)

  if (elapsedMs < MIN_GAP_TO_REPORT_MS) {
    return { state: { ...state, lastSavedAt: now }, summary: null }
  }

  const cappedMs = Math.min(elapsedMs, OFFLINE_CAP_MS)
  const wasCapped = elapsedMs > OFFLINE_CAP_MS

  const resourcesBefore = state.resources
  const buildingsBefore = state.buildings
  const disciplesBefore = state.disciples

  let working = state
  let remaining = cappedMs
  // Walks from the start of the (capped) gap up to the real `now` in the
  // same 10s chunks as `step`, reaching exactly `now` on the final
  // iteration. One-shot completions (construction/crafting/research/
  // teaching/missions) resolve identically either way, but periodic
  // resolvers — the mission board refresh, and Wave 7's territory claim/
  // world event/narrative event lifecycles — need an actually-advancing
  // clock to fire more than once across a long gap; comparing every chunk
  // against the same frozen real `now` let them trigger once and then get
  // permanently stuck "not due yet" for the rest of the loop.
  let simulatedNow = now - cappedMs
  const missionOutcomes: MissionLogEntry[] = []
  const itemsCrafted: string[] = []
  const researchCompleted: string[] = []
  const techniquesTaught: TeachingCompletion[] = []
  const territoriesClaimed: string[] = []
  const worldEventsResolved: EventLogEntry[] = []
  const narrativeEventsResolved: EventLogEntry[] = []
  while (remaining > 0) {
    const step = Math.min(CATCHUP_CHUNK_MS, remaining)
    simulatedNow += step
    const buildings = resolveCompletedConstruction(working.buildings, simulatedNow)
    working = { ...working, buildings }
    const craftResult = resolveCompletedCrafting(working, simulatedNow)
    working = craftResult.state
    if (craftResult.itemCrafted) itemsCrafted.push(getItemDisplayName(craftResult.itemCrafted, craftResult.craftedQuality))
    const researchResult = resolveCompletedResearch(working, simulatedNow)
    working = researchResult.state
    if (researchResult.projectCompleted) researchCompleted.push(getResearchProjectDef(researchResult.projectCompleted).name)
    const teachResult = resolveCompletedTeaching(working.disciples, simulatedNow)
    working = { ...working, disciples: teachResult.disciples }
    techniquesTaught.push(...teachResult.completions)
    const missionResult = resolveCompletedMissions(working, simulatedNow)
    working = missionResult.state
    missionOutcomes.push(...missionResult.logEntries)
    const territoryResult = resolveCompletedTerritoryClaim(working, simulatedNow)
    working = territoryResult.state
    if (territoryResult.territoryClaimed) territoriesClaimed.push(getTerritoryDef(territoryResult.territoryClaimed).name)
    const worldEventResult = resolveWorldEventLifecycle(working, simulatedNow)
    working = worldEventResult.state
    if (worldEventResult.logEntry) worldEventsResolved.push(worldEventResult.logEntry)
    const narrativeEventResult = resolveEventLifecycle(working, simulatedNow)
    working = narrativeEventResult.state
    if (narrativeEventResult.logEntry) narrativeEventsResolved.push(narrativeEventResult.logEntry)
    const resourcesAfterProduction = applyProductionTick(working, step)
    working = { ...working, resources: resourcesAfterProduction }
    const { disciples, resources } = applyCultivationTick(working, step)
    working = { ...working, disciples, resources }
    remaining -= step
  }

  working = { ...working, lastSavedAt: now }

  const resourceGains: Partial<Resources> = {}
  for (const key of Object.keys(createEmptyResources()) as (keyof Resources)[]) {
    const gain = working.resources[key] - resourcesBefore[key]
    if (gain > 0.05) resourceGains[key] = gain
  }

  const buildingsCompleted: string[] = []
  for (const [id, after] of Object.entries(working.buildings)) {
    const before = buildingsBefore[id]
    if (before?.constructionEndsAt !== undefined && after.constructionEndsAt === undefined && after.level > before.level) {
      buildingsCompleted.push(`${getBuildingDef(id).name} reached level ${after.level}`)
    }
  }

  const discipleBreakthroughs: OfflineSummary['discipleBreakthroughs'] = []
  const injuriesRecovered: string[] = []
  const disciplesReturned: string[] = []
  for (const after of working.disciples) {
    const before = disciplesBefore.find((d) => d.id === after.id)
    if (!before) continue
    if (before.realm !== after.realm) {
      discipleBreakthroughs.push({ name: after.name, fromRealm: before.realm, toRealm: after.realm })
    }
    if (before.injury !== 'none' && after.injury === 'none') {
      injuriesRecovered.push(after.name)
    }
    if (before.awayUntil !== undefined && after.awayUntil === undefined) {
      disciplesReturned.push(after.name)
    }
  }

  return {
    state: working,
    summary: {
      elapsedMs,
      cappedMs,
      wasCapped,
      resourceGains,
      buildingsCompleted,
      discipleBreakthroughs,
      injuriesRecovered,
      disciplesReturned,
      missionOutcomes,
      itemsCrafted,
      researchCompleted,
      techniquesTaught,
      territoriesClaimed,
      worldEventsResolved,
      narrativeEventsResolved,
    },
  }
}

/**
 * Shifts every pending epoch-ms timestamp in the state backward by
 * `offsetMs`, in addition to `lastSavedAt`. Used only by the debug "Simulate
 * Offline Gap" button: without this, a construction/injury/away/boost timer
 * that's only seconds into its real countdown wouldn't look "already past"
 * to `applyOfflineCatchUp` (which checks real `Date.now()`), so it wouldn't
 * be swept up as completed during the simulated gap. A genuine offline gap
 * doesn't need this — by the time a real reload happens, real time actually
 * has advanced past those timestamps on its own.
 */
export function rewindStateClock(state: GameState, offsetMs: number): GameState {
  const shift = (ts: number | undefined) => (ts === undefined ? undefined : ts - offsetMs)

  return {
    ...state,
    lastSavedAt: state.lastSavedAt - offsetMs,
    qiStoneProductionPenaltyUntil: shift(state.qiStoneProductionPenaltyUntil),
    buildings: Object.fromEntries(
      Object.entries(state.buildings).map(([id, building]) => [
        id,
        { ...building, constructionEndsAt: shift(building.constructionEndsAt) },
      ]),
    ),
    disciples: state.disciples.map((disciple) => ({
      ...disciple,
      injuryRecoversAt: shift(disciple.injuryRecoversAt),
      awayUntil: shift(disciple.awayUntil),
      activeBoostUntil: shift(disciple.activeBoostUntil),
      learningTechniqueUntil: shift(disciple.learningTechniqueUntil),
    })),
    activeMissions: state.activeMissions.map((mission) => ({
      ...mission,
      startedAt: mission.startedAt - offsetMs,
      endsAt: mission.endsAt - offsetMs,
    })),
    missionBoard: { ...state.missionBoard, nextRefreshAt: state.missionBoard.nextRefreshAt - offsetMs },
    craftingQueue: state.craftingQueue && { ...state.craftingQueue, endsAt: state.craftingQueue.endsAt - offsetMs },
    researchQueue: state.researchQueue && { ...state.researchQueue, endsAt: state.researchQueue.endsAt - offsetMs },
    territoryClaimQueue: state.territoryClaimQueue && {
      ...state.territoryClaimQueue,
      endsAt: state.territoryClaimQueue.endsAt - offsetMs,
    },
    worldEvent: state.worldEvent && { ...state.worldEvent, endsAt: state.worldEvent.endsAt - offsetMs },
    nextWorldEventAt: state.nextWorldEventAt - offsetMs,
    nextEventAt: state.nextEventAt - offsetMs,
    diplomaticActionCooldowns: Object.fromEntries(
      Object.entries(state.diplomaticActionCooldowns).map(([key, ts]) => [key, ts - offsetMs]),
    ),
  }
}
