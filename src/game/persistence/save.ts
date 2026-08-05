import { DISCIPLE_TEMPERAMENTS, SAVE_VERSION, type DiscipleInstance, type GameState } from '../types'
import { createNewGame } from '../state/initialState'
import { hashString } from '../engine/rng'
import { MAX_HP } from '../engine/injury'

const STORAGE_KEY = 'sect-master-save'

/**
 * Save migrations keyed by the version they upgrade *from*: each takes a raw save
 * at version N and returns it reshaped so its `saveVersion` reads N+1 (or higher).
 * Applied in ascending order by `runMigrations`; if the chain from the save's
 * version up to SAVE_VERSION has a gap, the save is discarded — the pre-existing
 * no-migration behaviour, now the explicit fallback rather than the only path.
 *
 * Empty today. The seam exists ahead of need (WORLD_MAP_DESIGN §13.3): the World
 * Map wave introduces the first irreversible player choice (the founding
 * decision), so losing a save to a later version bump becomes materially worse
 * than losing a pre-World-Map one — the cheapest moment to add the hook is now,
 * while a discard still costs nothing.
 */
const MIGRATIONS: Record<number, (raw: unknown) => unknown> = {
  // v19 → v20 (Combat Polishing): backfill each disciple's new required `temperament`. Derived from the name-hash so a disciple keeps the exact
  // epithet it was already showing in battle narration (zero visible change) — only newly-recruited disciples get a freshly-rolled random one.
  19: (raw) => {
    const s = raw as GameState & { disciples: DiscipleInstance[] }
    return {
      ...s,
      saveVersion: 20,
      disciples: s.disciples.map((d) =>
        d.temperament ? d : { ...d, temperament: DISCIPLE_TEMPERAMENTS[(hashString(d.name) >>> 0) % DISCIPLE_TEMPERAMENTS.length] },
      ),
    }
  },
  // v20 → v21 (Health System Phase 1): the stored injury band becomes a derived HP pool. Map each band to a
  // representative HP so the disciple keeps roughly the same band+recovery it had, set the new flat `maxHp`,
  // and drop the two retired fields (`injury`, `injuryRecoversAt`).
  20: (raw) => {
    const s = raw as { disciples: Record<string, unknown>[] }
    const BAND_HP: Record<string, number> = { none: 100, minor: 82, major: 50, critical: 20 }
    return {
      ...s,
      saveVersion: 21,
      disciples: s.disciples.map((d) => {
        const { injury, injuryRecoversAt: _drop, ...rest } = d
        return { ...rest, maxHp: MAX_HP, health: BAND_HP[(injury as string) ?? 'none'] ?? MAX_HP }
      }),
    }
  },
}

/**
 * Walks a raw parsed save up to SAVE_VERSION through MIGRATIONS. Returns the
 * upgraded save, or null when no path exists (→ discard, as before). Kept
 * defensive: a migration that fails to advance the version is treated as a gap
 * rather than looped on forever.
 */
function runMigrations(raw: { saveVersion?: number }): GameState | null {
  let version = raw.saveVersion
  let current: unknown = raw
  while (version !== SAVE_VERSION) {
    if (version === undefined) return null
    const migrate = MIGRATIONS[version]
    if (!migrate) return null
    current = migrate(current)
    const nextVersion = (current as { saveVersion?: number }).saveVersion
    if (nextVersion === undefined || nextVersion <= version) return null
    version = nextVersion
  }
  return current as GameState
}

export function saveGame(state: GameState): void {
  const toStore: GameState = { ...state, lastSavedAt: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as { saveVersion?: number }
    // Version match returns the save as-is; a mismatch routes through the
    // migration chain, which discards when no upgrade path exists (§13.3).
    return runMigrations(parsed)
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function loadOrCreateGame(): GameState {
  return loadGame() ?? createNewGame()
}
