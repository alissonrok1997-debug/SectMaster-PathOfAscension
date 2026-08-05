import type { BattleTerrain, LocationId } from '../../types'
import { hashString } from '../rng'

/**
 * Location → terrain (Combat Polishing Phase 7). v1 DERIVES a stable terrain from the location id (reproducible, no def edits, no save migration) — the
 * combat effects of each terrain live in engine/combat/battleSimulator.ts (TERRAIN_EFFECTS). A hand-authored terrain-per-location mapping is a later polish;
 * because every battle SNAPSHOTS the resolved terrain, swapping this derivation out never desyncs existing reports.
 */
const TERRAINS: BattleTerrain[] = ['open', 'mountain', 'forest', 'river', 'fortress', 'sacred']

export function getLocationTerrain(locationId: LocationId): BattleTerrain {
  return TERRAINS[(hashString(`terrain:${locationId}`) >>> 0) % TERRAINS.length]
}
