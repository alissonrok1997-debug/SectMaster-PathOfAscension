import { RESOURCE_LABELS } from '../data/resourceLabels'
import type { Resources } from '../types'

/**
 * Compact readout for the fixed resource strip: 1234 → "1.2k", 1_100_000 → "1.1M".
 * Truncates rather than rounds, so a value never reads as having crossed a threshold
 * it hasn't (999_999 shows "999.9k", not "1M").
 */
export function formatCompact(n: number): string {
  const v = Math.floor(n)
  if (v < 1000) return String(v)
  const trim = (x: number, suffix: string) =>
    `${x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}${suffix}`
  for (const [limit, suffix] of [
    [1e6, 'k'],
    [1e9, 'M'],
    [1e12, 'B'],
  ] as const) {
    if (v < limit) return trim(Math.floor((v / (limit / 1000)) * 10) / 10, suffix)
  }
  return trim(Math.floor((v / 1e12) * 10) / 10, 'T')
}

/** Shared "40 Knowledge, 60 Spirit Stones" cost/reward formatting — used by any panel that lists a Partial<Resources>. */
export function formatResourceCost(cost: Partial<Resources>): string {
  return (Object.entries(cost) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}
