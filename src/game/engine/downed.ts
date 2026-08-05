import { CULTIVATION_REALMS, type DiscipleInstance, type EventLogEntry, type GameState } from '../types'
import { hashString, mulberry32 } from './rng'
import { removeDiscipleFromRoster } from './roster'

/**
 * The downed roll (HEALTH_SYSTEM_PLAN Phase 5) — the consequence that makes HP matter. A player disciple
 * dropped to 0 HP is not instantly dead: they roll once on a fate table, weighted heavily toward the mild
 * outcomes (doc 06 §7's "severe outcomes stay rare"). NPCs never roll — they have no roster. This runs as a
 * GameState-level pass after every wound-producing resolver, so `removeDiscipleFromRoster` always sees a
 * coherent state and clears references correctly.
 */

export type DownedFate = 'unconscious' | 'maimed' | 'crippled' | 'death'

/** How long a downed survivor is incapacitated before waking (the "long recovery"). Longer than a full HP regen, so being downed genuinely costs time. */
export const DOWNED_RECOVERY_MS = 120_000
/** HP a downed disciple wakes at — enough to act, still visibly hurt; normal regen takes them the rest of the way. */
const WAKE_HP_FRACTION = 0.3
/** Permanent Talent lost to a maiming. */
const MAIM_TALENT_LOSS = 10
/** A death shocks the whole sect's morale, floored so it can't stack with a battle defeat into the death-spiral combatPower.ts already guards against. */
const DEATH_MORALE_HIT = 6
const DEATH_MORALE_FLOOR = 30

const EVENT_LOG_LIMIT = 10

/** Weighted fate roll — unconscious is by far the most common; death is rare. Magnitudes are tuning. */
function rollDownedFate(rng: () => number): DownedFate {
  const r = rng()
  if (r < 0.7) return 'unconscious'
  if (r < 0.85) return 'maimed'
  if (r < 0.95) return 'crippled'
  return 'death'
}

/** Wakes a downed disciple whose recovery window has elapsed: clears the flag and lifts HP to the wake floor so normal regen resumes and the post-pass won't re-roll them. */
export function wakeIfRecovered(disciple: DiscipleInstance, now: number): DiscipleInstance {
  if (disciple.downedUntil === undefined || disciple.downedUntil > now) return disciple
  return { ...disciple, downedUntil: undefined, health: Math.max(disciple.health, disciple.maxHp * WAKE_HP_FRACTION) }
}

/** True while a disciple is incapacitated by a downed recovery (blocked from assignment, not cultivating). */
export function isDowned(disciple: DiscipleInstance, now: number): boolean {
  return disciple.downedUntil !== undefined && disciple.downedUntil > now
}

function logEntry(now: number, name: string, text: string): EventLogEntry {
  return { id: crypto.randomUUID(), source: 'sect', defId: 'downed', name, text, resolvedAt: now }
}

function updateDisciple(state: GameState, id: string, fn: (d: DiscipleInstance) => DiscipleInstance): GameState {
  return { ...state, disciples: state.disciples.map((d) => (d.id === id ? fn(d) : d)) }
}

/** How a death is narrated (Phase 5): buried-with-possessions on a win, stripped-by-the-enemy on a loss, or a generic "lost to the sect" when there's no battle framing (offline settle, failed breakthrough, a gather mishap). */
function deathText(name: string, won: boolean | undefined): string {
  if (won === undefined) return `${name} was struck down and lost to the sect — their possessions gone with them.`
  return won
    ? `${name} fell in the fighting — their comrades bore them home and buried them with their possessions.`
    : `${name} fell as the battle was lost — cut down and stripped by the enemy.`
}

/** Applies one disciple's downed fate (seeded), returning the new state, the loud log entry, and whether they were lost from the roster. `won` frames a death's narration. */
function applyDownedFate(
  state: GameState,
  disciple: DiscipleInstance,
  now: number,
  seed: number,
  won: boolean | undefined,
): { state: GameState; logEntry: EventLogEntry; lost: boolean } {
  const fate = rollDownedFate(mulberry32(hashString(`downed:${disciple.id}:${seed}`) >>> 0))

  if (fate === 'death') {
    return {
      state: removeDiscipleFromRoster(state, disciple.id, { returnGear: false, reason: 'died' }),
      logEntry: logEntry(now, `${disciple.name} has fallen`, deathText(disciple.name, won)),
      lost: true,
    }
  }

  if (fate === 'crippled') {
    const realmIndex = CULTIVATION_REALMS.indexOf(disciple.realm)
    if (realmIndex <= 0) {
      // No realm to regress to — crippled back into a mortal, they leave the sect alive (gear returned), narrated as its own ending.
      return {
        state: removeDiscipleFromRoster(state, disciple.id, { returnGear: true, reason: 'crippledToMortal' }),
        logEntry: logEntry(now, `${disciple.name} crippled`, `${disciple.name}'s cultivation base was shattered beyond recovery — they leave the sect to live out their days as a mortal.`),
        lost: true,
      }
    }
    const newRealm = CULTIVATION_REALMS[realmIndex - 1]
    return {
      state: updateDisciple(state, disciple.id, (x) => ({ ...x, realm: newRealm, subRealm: 1, cultivationProgress: 0, downedUntil: now + DOWNED_RECOVERY_MS })),
      logEntry: logEntry(now, `${disciple.name} crippled`, `${disciple.name} was gravely wounded — their cultivation regressed to ${newRealm}. They must climb back the hard way.`),
      lost: false,
    }
  }

  if (fate === 'maimed') {
    return {
      state: updateDisciple(state, disciple.id, (x) => ({ ...x, talent: Math.max(1, x.talent - MAIM_TALENT_LOSS), downedUntil: now + DOWNED_RECOVERY_MS })),
      logEntry: logEntry(now, `${disciple.name} maimed`, `${disciple.name} was maimed in the fighting — permanently weakened (−${MAIM_TALENT_LOSS} Talent) and out for a long recovery.`),
      lost: false,
    }
  }

  // unconscious — the common, mild outcome: a long recovery, no permanent cost.
  return {
    state: updateDisciple(state, disciple.id, (x) => ({ ...x, downedUntil: now + DOWNED_RECOVERY_MS })),
    logEntry: logEntry(now, `${disciple.name} downed`, `${disciple.name} was knocked unconscious and dragged from the field — a long recovery ahead.`),
    lost: false,
  }
}

/** Applies the floored morale shock of a loss to a set of ids (survivors), so a death can't compound a defeat penalty into a death-spiral. */
function applyLossMorale(state: GameState, ids: (d: DiscipleInstance) => boolean): GameState {
  return { ...state, disciples: state.disciples.map((d) => (ids(d) ? { ...d, morale: Math.max(DEATH_MORALE_FLOOR, d.morale - DEATH_MORALE_HIT) } : d)) }
}

/**
 * Resolves every disciple sitting at 0 HP who hasn't yet rolled (fresh downs only — `downedUntil` marks
 * an already-processed one), sect-wide. The tick/offline safety net for downs with no battle context
 * (a failed breakthrough, a gather mishap). A loss shakes the whole sect's morale (floored). Seeded per disciple.
 */
export function resolveDownedDisciples(
  state: GameState,
  now: number,
  seed: number,
): { state: GameState; deaths: string[]; logEntries: EventLogEntry[] } {
  const fresh = state.disciples.filter((d) => d.health <= 0 && d.downedUntil === undefined)
  if (fresh.length === 0) return { state, deaths: [], logEntries: [] }

  let working = state
  const deaths: string[] = []
  const logEntries: EventLogEntry[] = []
  let anyLoss = false

  for (const d of fresh) {
    const result = applyDownedFate(working, d, now, seed, undefined)
    working = result.state
    logEntries.push(result.logEntry)
    if (result.lost) {
      deaths.push(d.name)
      anyLoss = true
    }
  }

  if (anyLoss) working = applyLossMorale(working, () => true)

  return { state: { ...working, eventLog: [...logEntries, ...working.eventLog].slice(0, EVENT_LOG_LIMIT) }, deaths, logEntries }
}

/**
 * Resolves the downs of ONE battle's squad (HEALTH_SYSTEM_PLAN Phase 5) — called by each combat resolver right
 * after it applies wounds, while it still knows the squad and the outcome. `won` frames each death's narration
 * (buried vs looted); the morale shock is scoped to the surviving squad, not the whole sect. Returns the death
 * names for the battle report. Any straggler down outside this squad is still caught by resolveDownedDisciples.
 */
export function resolveSquadDowned(
  state: GameState,
  squadIds: string[],
  now: number,
  seed: number,
  opts: { won: boolean },
): { state: GameState; deaths: string[]; logEntries: EventLogEntry[] } {
  const squad = new Set(squadIds)
  const fresh = state.disciples.filter((d) => squad.has(d.id) && d.health <= 0 && d.downedUntil === undefined)
  if (fresh.length === 0) return { state, deaths: [], logEntries: [] }

  let working = state
  const deaths: string[] = []
  const logEntries: EventLogEntry[] = []
  let anyLoss = false

  for (const d of fresh) {
    const result = applyDownedFate(working, d, now, seed, opts.won)
    working = result.state
    logEntries.push(result.logEntry)
    if (result.lost) {
      deaths.push(d.name)
      anyLoss = true
    }
  }

  // Scope the morale shock to the survivors still in this squad (they watched a comrade fall), not the whole sect.
  if (anyLoss) working = applyLossMorale(working, (d) => squad.has(d.id))

  return { state: { ...working, eventLog: [...logEntries, ...working.eventLog].slice(0, EVENT_LOG_LIMIT) }, deaths, logEntries }
}
