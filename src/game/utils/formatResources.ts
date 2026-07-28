import { RESOURCE_LABELS } from '../data/resourceLabels'
import type { Resources } from '../types'

/** Shared "40 Knowledge, 60 Spirit Stones" cost/reward formatting — used by any panel that lists a Partial<Resources>. */
export function formatResourceCost(cost: Partial<Resources>): string {
  return (Object.entries(cost) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}
