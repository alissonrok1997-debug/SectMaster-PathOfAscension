import { RESOURCE_LABELS } from '../data/resourceLabels'
import type { Resources } from '../types'

/**
 * Compact readout for the fixed resource strip.
 *
 * **§10: never abbreviate below four digits.** `1240` reads as a quantity; `1.2k` reads as
 * analytics — and until 2026-08-16 this function abbreviated from 1000, so the most-seen
 * surface in the game rendered a four-figure stockpile as `1.2k` on every screen. The
 * threshold is now 10,000, which is also where abbreviation starts to *pay*: `9999` and
 * `9.9k` are the same width, while `12.3k` beats `12345`.
 *
 * Truncates rather than rounds, so a value never reads as having crossed a threshold it
 * hasn't (999_999 shows `999k`, not `1M`). Above 100k the decimal is dropped — three
 * significant figures is already more precision than a glance uses.
 */
export function formatCompact(n: number): string {
  const v = Math.floor(n)
  if (v < 10_000) return String(v)

  for (const [limit, divisor, suffix] of [
    [1e6, 1e3, 'k'],
    [1e9, 1e6, 'M'],
    [1e12, 1e9, 'B'],
  ] as const) {
    if (v < limit) {
      const scaled = v / divisor
      // One decimal only while it adds information; past 100 the integer is enough.
      return scaled >= 100
        ? `${Math.floor(scaled)}${suffix}`
        : `${(Math.floor(scaled * 10) / 10).toFixed(1)}${suffix}`
    }
  }
  return `${Math.floor(v / 1e12)}T`
}

/** Shared "40 Knowledge, 60 Spirit Stones" cost/reward formatting — used by any panel that lists a Partial<Resources>. */
export function formatResourceCost(cost: Partial<Resources>): string {
  return (Object.entries(cost) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}
