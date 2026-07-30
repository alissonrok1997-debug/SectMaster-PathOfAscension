import { CULTIVATION_REALMS, type DiscipleInstance, type EventLogEntry, type GameState } from '../types'
import { getWorldModifiers } from './world/worldModifiers'

/**
 * Disciple upkeep (doc 03, Section 7's deferred "Treasury upkeep gate", pulled in as a real ongoing
 * cost). Charged as a lump sum once per interval, scaled by realm — stronger disciples are a heavier
 * burden. A paid cycle nudges morale up; an unpaid cycle drops it hard, and at rock bottom risks the
 * disciple abandoning the sect. Low morale also slows cultivation (see getDiscipleCultivationRate).
 * Dev-placeholder scale, tunable in a later balance pass.
 */
export const UPKEEP_INTERVAL_MS = 3_600_000 // charged once per hour

const UPKEEP_SPIRIT_STONE_PER_CYCLE = 3.6 // per realm rank, per cycle
const UPKEEP_QI_STONE_PER_CYCLE = 1.8

const MORALE_UNPAID_PENALTY = 10 // morale lost per disciple on an unpaid cycle
const MORALE_PAID_BONUS = 1 // morale gained per disciple on a paid cycle
const LOW_MORALE_THRESHOLD = 20
const DEPARTURE_CHANCE_PER_UNPAID_CYCLE = 0.25

// Matches the cap used by the other Sect Chronicle writers (events.ts / worldEvents.ts).
const EVENT_LOG_LIMIT = 10

/** Spirit Stone + Qi Stone this disciple costs per upkeep cycle, scaled by realm rank. */
export function getDiscipleUpkeep(disciple: DiscipleInstance): { spiritStones: number; qiStone: number } {
  const realmFactor = CULTIVATION_REALMS.indexOf(disciple.realm) + 1
  return {
    spiritStones: UPKEEP_SPIRIT_STONE_PER_CYCLE * realmFactor,
    qiStone: UPKEEP_QI_STONE_PER_CYCLE * realmFactor,
  }
}

/** Total Spirit Stone + Qi Stone the whole roster owes each cycle — the number the UI displays. Scaled by the sect site's upkeep modifier (§4.2, e.g. Mistfen Hollow -10%). */
export function getSectUpkeepPerCycle(state: GameState): { spiritStones: number; qiStone: number } {
  const upkeepMult = getWorldModifiers(state).upkeepMult
  return state.disciples.reduce(
    (sum, d) => {
      const cost = getDiscipleUpkeep(d)
      return {
        spiritStones: sum.spiritStones + cost.spiritStones * upkeepMult,
        qiStone: sum.qiStone + cost.qiStone * upkeepMult,
      }
    },
    { spiritStones: 0, qiStone: 0 },
  )
}

/** Whether current reserves cover the next upkeep cycle — drives the "can't afford" warning. */
export function isUpkeepAffordable(state: GameState): boolean {
  const upkeep = getSectUpkeepPerCycle(state)
  return state.resources.spiritStones >= upkeep.spiritStones && state.resources.qiStone >= upkeep.qiStone
}

function departureLogEntry(disciple: DiscipleInstance, now: number): EventLogEntry {
  return {
    id: crypto.randomUUID(),
    source: 'sect',
    defId: 'discipleDeparture',
    name: `${disciple.name} left the sect`,
    text: 'Morale collapsed under unpaid upkeep, and they abandoned the sect.',
    resolvedAt: now,
  }
}

/**
 * Periodic resolver (doc 09's "sweep whatever's due" shape, like the Mission Board / world-event
 * timers): charges every upkeep cycle that has come due. Called from both the live tick and the
 * offline catch-up loop, so it must receive the loop's `simulatedNow`, not the real clock, and loops
 * to settle multiple cycles crossed during a long gap.
 */
export function resolveUpkeepDue(state: GameState, now: number): { state: GameState } {
  // Lazily initialise the first due time (protects against a 0 default leaking in).
  if (state.nextUpkeepAt <= 0) {
    return { state: { ...state, nextUpkeepAt: now + UPKEEP_INTERVAL_MS } }
  }
  if (now < state.nextUpkeepAt) return { state }

  let resources = state.resources
  let disciples = state.disciples
  let eventLog = state.eventLog
  let nextUpkeepAt = state.nextUpkeepAt
  // Sect-site upkeep modifier (§4.2). Constant over the loop — sectLocation never changes — so it's read once.
  const upkeepMult = getWorldModifiers(state).upkeepMult

  while (now >= nextUpkeepAt) {
    const cost = disciples.reduce(
      (sum, d) => {
        const c = getDiscipleUpkeep(d)
        return {
          spiritStones: sum.spiritStones + c.spiritStones * upkeepMult,
          qiStone: sum.qiStone + c.qiStone * upkeepMult,
        }
      },
      { spiritStones: 0, qiStone: 0 },
    )
    const affordable = resources.spiritStones >= cost.spiritStones && resources.qiStone >= cost.qiStone

    if (affordable) {
      resources = {
        ...resources,
        spiritStones: resources.spiritStones - cost.spiritStones,
        qiStone: resources.qiStone - cost.qiStone,
      }
      disciples = disciples.map((d) => ({ ...d, morale: Math.min(100, d.morale + MORALE_PAID_BONUS) }))
    } else {
      const survivors: DiscipleInstance[] = []
      const departures: DiscipleInstance[] = []
      for (const d of disciples) {
        const morale = Math.max(0, d.morale - MORALE_UNPAID_PENALTY)
        // An away disciple can't walk out mid-assignment (Presence Requirement, doc 03 §8).
        if (
          morale <= LOW_MORALE_THRESHOLD &&
          d.awayUntil === undefined &&
          Math.random() < DEPARTURE_CHANCE_PER_UNPAID_CYCLE
        ) {
          departures.push({ ...d, morale })
        } else {
          survivors.push({ ...d, morale })
        }
      }
      disciples = survivors
      if (departures.length > 0) {
        eventLog = [...departures.map((d) => departureLogEntry(d, now)), ...eventLog].slice(0, EVENT_LOG_LIMIT)
      }
    }

    nextUpkeepAt += UPKEEP_INTERVAL_MS
  }

  return { state: { ...state, resources, disciples, eventLog, nextUpkeepAt } }
}
