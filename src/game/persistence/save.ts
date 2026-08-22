import {
  DISCIPLE_TEMPERAMENTS,
  SAVE_VERSION,
  type CombatReportEntry,
  type DiscipleInstance,
  type ExpeditionLogEntry,
  type GameState,
  type MissionLogEntry,
  type WorldState,
} from '../types'
import { createNewGame } from '../state/initialState'
import { hashString } from '../engine/rng'
import { MAX_HP } from '../engine/injury'
import { REPORT_INBOX_LIMIT } from '../engine/combat/reportInbox'
import { buildLegacyBlueprint } from '../engine/world/worldBlueprint'
import { generateTerritoryNodes } from '../engine/world/worldGeneration'
import { WORLD_GEN_CONFIG } from '../engine/world/worldGen/worldGenConfig'

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
  // v21 → v22 (Crafting Recipe Pack Phase 3): add the separate crafting-materials bag.
  // Empty for existing saves — materials have no acquisition source yet (debug grant only).
  21: (raw) => {
    const s = raw as GameState
    return { ...s, saveVersion: 22, materials: s.materials ?? {} }
  },
  // v22 → v23 (Equipment Depth): affixes + provenance are all optional fields, so a v22 ItemInstance is
  // already structurally valid at v23 — legacy equipment simply reads as plain gear with no history. The
  // migration only advances the version (EQUIPMENT_DEPTH_PLAN §8 migration note).
  22: (raw) => {
    const s = raw as GameState
    return { ...s, saveVersion: 23 }
  },
  // v23 → v24 (Combat Report Inbox): add the reports inbox and backfill it from the battle reports still
  // sitting in the two capped logs, so an existing save opens the new tab with history rather than an empty
  // screen. Backfilled entries are marked read — they predate the feature and shouldn't fire an unread badge.
  23: (raw) => {
    const s = raw as GameState & { world?: { expeditionLog?: ExpeditionLogEntry[] } }
    const fromMissions: CombatReportEntry[] = (s.missionLog ?? [])
      .filter((e): e is MissionLogEntry & { battleResult: NonNullable<MissionLogEntry['battleResult']> } => !!e.battleResult)
      .map((e) => ({
        id: `mission:${e.id}`,
        source: 'mission',
        title: e.missionName,
        participantNames: e.squadNames,
        participantTemperaments: e.squadTemperaments,
        battle: e.battleResult,
        resolvedAt: e.resolvedAt,
        read: true,
        sourceEntryId: e.id,
      }))
    // world may be undefined on a pre-World-Map save — guard it.
    const fromExpeditions: CombatReportEntry[] = (s.world?.expeditionLog ?? [])
      .filter((e): e is ExpeditionLogEntry & { battleResult: NonNullable<ExpeditionLogEntry['battleResult']> } => !!e.battleResult)
      .map((e) => {
        const isDefense = e.battleResult.playerRole === 'defender'
        return {
          id: `${isDefense ? 'def' : 'exp'}:${e.id}`,
          source: isDefense ? 'defense' : 'expedition',
          title: e.locationName,
          subtitle: isDefense
            ? `Raided by ${e.battleResult.attackerName ?? 'a rival sect'}`
            : e.purpose === 'raid'
              ? 'Raid'
              : 'Claim',
          participantNames: e.discipleNames,
          participantTemperaments: e.discipleTemperaments,
          battle: e.battleResult,
          resolvedAt: e.resolvedAt,
          read: true,
          sourceEntryId: e.id,
        }
      })
    const reports = [...fromMissions, ...fromExpeditions]
      .sort((a, b) => b.resolvedAt - a.resolvedAt)
      .slice(0, REPORT_INBOX_LIMIT)
    return { ...s, saveVersion: 24, reports }
  },
  // v24 → v25 (World Procgen Wave 1): inject the legacy blueprint into any founded world so
  // the worldAccess shim reads the same authored values it always had. Pre-founding saves have
  // no `world` — just bump the version (a fresh founding builds the blueprint itself).
  24: (raw) => {
    const s = raw as GameState
    if (!s.world) return { ...s, saveVersion: 25 }
    return {
      ...s,
      saveVersion: 25,
      world: { ...s.world, blueprint: s.world.blueprint ?? buildLegacyBlueprint(s.world.seed) },
    }
  },
  // v25 → v26 (World Procgen Wave 3): handcrafted landmarks are retired, so a founded world's
  // resource nodes must live in `generatedNodes`. Regenerate the per-territory nodes for any
  // province whose node list is empty (authored/Wave-2 worlds relied on landmarks), from the
  // stored blueprint — deterministic, so it matches what a fresh founding would produce.
  25: (raw) => {
    const s = raw as GameState
    if (!s.world) return { ...s, saveVersion: 26 }
    const territories = s.world.blueprint?.territories ?? []
    const generatedNodes = { ...s.world.generatedNodes }
    if ((generatedNodes.firstRealm?.length ?? 0) === 0) {
      generatedNodes.firstRealm = generateTerritoryNodes(territories, s.world.seed, WORLD_GEN_CONFIG)
    }
    return { ...s, saveVersion: 26, world: { ...s.world, generatedNodes } }
  },
  // v26 → v27 (World Procgen Wave 5): the world seed is now top-level GameState (rolled at new game),
  // so backfill it for old saves from their founded world's seed (or a fresh roll if never founded).
  26: (raw) => {
    const s = raw as GameState
    return { ...s, saveVersion: 27, worldSeed: s.worldSeed ?? s.world?.seed ?? Math.floor(Math.random() * 0x7fffffff) }
  },
  // v27 → v28 (MULTIPLAYER_PLAN Wave 0): NPCs no longer sit on Poor seats, and there is no emergence.
  // Converge an existing realm on the new rule — evict every NPC whose seat is Poor, free the seats they
  // held, and drop the retired `nextNpcEmergenceAt`. Seat tier comes from the save's own stored blueprint,
  // so a sect that had climbed off a Poor seat is correctly left alone. Prestige-seat NPCs are untouched.
  27: (raw) => {
    const s = raw as GameState & { world?: WorldState & { nextNpcEmergenceAt?: number } }
    if (!s.world) return { ...s, saveVersion: 28 }
    const { nextNpcEmergenceAt: _retired, ...world } = s.world
    const isPoorSeat = (seatId: string) => world.blueprint?.sites?.[seatId]?.tier === 'poor'
    const evicted = new Set(world.npcSects.filter((n) => isPoorSeat(n.seatSiteId)).map((n) => n.id))
    if (evicted.size === 0) return { ...s, saveVersion: 28, world }

    const locations = Object.fromEntries(
      Object.entries(world.locations).map(([id, runtime]) =>
        runtime.ownerId && evicted.has(runtime.ownerId) ? [id, { ...runtime, ownerId: undefined, garrison: undefined }] : [id, runtime],
      ),
    )
    return {
      ...s,
      saveVersion: 28,
      world: {
        ...world,
        locations,
        // Drop the evicted sects, and scrub them from every survivor's rivalry list so no id dangles.
        npcSects: world.npcSects
          .filter((n) => !evicted.has(n.id))
          .map((n) => (n.rivalIds?.some((id) => evicted.has(id)) ? { ...n, rivalIds: n.rivalIds.filter((id) => !evicted.has(id)) } : n)),
      },
    }
  },
  // v28 → v29 (MULTIPLAYER_PLAN Wave 1a): ownership is compared against `state.sectId` instead of the
  // literal 'player'. Every existing save IS the player's, and every ownerId it stored reads 'player',
  // so backfilling that exact value keeps the save's seats and outposts owned by it — a rename with no
  // reshaping. The field only starts varying once a realm holds more than one sect (Wave 3).
  28: (raw) => {
    const s = raw as GameState
    return { ...s, saveVersion: 29, sectId: s.sectId ?? 'player' }
  },
  // v29 → v30 (MULTIPLAYER_PLAN Wave 1b): `WorldState` becomes purely SHARED, so the two per-player
  // fields it was carrying move up onto the sect. Province discovery and a sect's own expedition log
  // differ between two sects in the same realm, so a server storing one WorldState per realm cannot
  // hold either. Pure relocation — same values, one level up.
  29: (raw) => {
    const s = raw as GameState & {
      world?: WorldState & { provinces?: GameState['provinces']; expeditionLog?: GameState['expeditionLog'] }
    }
    if (!s.world) return { ...s, saveVersion: 30, provinces: s.provinces ?? {}, expeditionLog: s.expeditionLog ?? [] }
    const { provinces, expeditionLog, ...world } = s.world
    return {
      ...s,
      saveVersion: 30,
      provinces: s.provinces ?? provinces ?? {},
      expeditionLog: s.expeditionLog ?? expeditionLog ?? [],
      world,
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
