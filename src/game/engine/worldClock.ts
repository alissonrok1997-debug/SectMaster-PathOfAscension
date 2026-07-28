/**
 * Cosmetic World Clock (doc 09, Section 2).
 *
 * 1 in-game day = 30 real-world minutes (20 min day + 10 min night).
 * Purely cosmetic/narrative — never feeds production, upgrades, or any
 * other simulation math. That all runs on the Simulation Clock instead.
 */

const DAY_PHASE_MS = 20 * 60 * 1000
const NIGHT_PHASE_MS = 10 * 60 * 1000
const FULL_DAY_MS = DAY_PHASE_MS + NIGHT_PHASE_MS

export type TimeOfDay = 'day' | 'night'

export interface WorldTime {
  /** 1-indexed in-game day number. */
  day: number
  timeOfDay: TimeOfDay
  /** 0..1 progress through the current day/night phase. */
  progress: number
}

export function msToWorldTime(totalElapsedMs: number): WorldTime {
  const dayIndex = Math.floor(totalElapsedMs / FULL_DAY_MS)
  const msIntoDay = totalElapsedMs - dayIndex * FULL_DAY_MS

  if (msIntoDay < DAY_PHASE_MS) {
    return {
      day: dayIndex + 1,
      timeOfDay: 'day',
      progress: msIntoDay / DAY_PHASE_MS,
    }
  }

  return {
    day: dayIndex + 1,
    timeOfDay: 'night',
    progress: (msIntoDay - DAY_PHASE_MS) / NIGHT_PHASE_MS,
  }
}
