import type { GameState, Resources } from '../types'
import { computeStorageCaps } from './storage'

/** Streak cycles every 7 days (doc 11 Section 19's weekly rhythm), then repeats rather than growing unbounded. */
const STREAK_CYCLE_DAYS = 7
const STREAK_DAILY_SPIRIT_STONES = 10

function toLocalDateString(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getStreakBonus(streakDay: number): Partial<Resources> {
  const cyclePosition = ((streakDay - 1) % STREAK_CYCLE_DAYS) + 1
  return { spiritStones: cyclePosition * STREAK_DAILY_SPIRIT_STONES }
}

export interface LoginStreakResolution {
  state: GameState
  bonus: { streakDay: number; resourceGains: Partial<Resources> } | null
  streakChanged: boolean
}

/** Resolves the daily login streak against the wall clock, independent of the offline-catchup gap (doc 09) — a streak advances on calendar days, not elapsed real time. */
export function resolveLoginStreak(state: GameState, now: number): LoginStreakResolution {
  const today = toLocalDateString(now)
  const { current, longest, lastLoginDate } = state.loginStreak

  if (lastLoginDate === today) {
    return { state, bonus: null, streakChanged: false }
  }

  const yesterday = toLocalDateString(now - 24 * 60 * 60 * 1000)
  const nextCurrent = lastLoginDate === yesterday ? current + 1 : 1
  const resourceGains = getStreakBonus(nextCurrent)

  const caps = computeStorageCaps(state)
  const resources = { ...state.resources }
  for (const [key, amount] of Object.entries(resourceGains) as [keyof Resources, number][]) {
    resources[key] = Math.min(caps[key], resources[key] + amount)
  }

  return {
    state: {
      ...state,
      resources,
      loginStreak: { current: nextCurrent, longest: Math.max(longest, nextCurrent), lastLoginDate: today },
    },
    bonus: { streakDay: nextCurrent, resourceGains },
    streakChanged: true,
  }
}
