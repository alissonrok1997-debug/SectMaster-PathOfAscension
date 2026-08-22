import type {
  LocationRuntime,
  ProvinceRuntime,
  NpcSect,
  SectId,
  ProvinceId,
  RegionId,
  SectLocation,
  SectSiteId,
  WorldState,
} from '../../types'
import type { ProvinceDefinition } from '../../data/world/provinceDefs'
import type { SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { generateTerritoryNodes } from './worldGeneration'
import { getBlueprintForSeed } from './worldGen/realmGenerator'
import { WORLD_GEN_CONFIG } from './worldGen/worldGenConfig'
import { NPC_BASE_ACTION_INTERVAL_MS } from './npcSimulation'
import { hashString, mulberry32 } from '../rng'

/**
 * The pre-game founding decision (WORLD_MAP_DESIGN §12.2). Eligibility is a pure
 * function shared by the FoundingScreen (to gate the Confirm button) and the
 * store action (to re-validate before mutating), same pattern as every other
 * gated action. `buildInitialWorldState` is the seed-in / world-out step the
 * store commits once, irreversibly.
 *
 * FIRST_REALM_PLAN §1 restricts founding to a free Poor seat: safe (never
 * conquerable) and not already occupied by a seeded minor NPC sect (§4.4).
 */

/**
 * Seed same-region rivalries (FIRST_REALM_PLAN §8 Wave D). Within each region the
 * sects are shuffled deterministically and linked in a ring, so every sect in a
 * multi-sect region gets a mutual rival (two, in regions of 3+) it preferentially
 * climbs/raids. Rivalry is asymmetric only through decline: a fallen rival becomes
 * easy prey. Dangling ids left by a destroyed rival are simply ignored downstream.
 */
function assignRivalries(sects: NpcSect[], seed: number): NpcSect[] {
  const rivals = new Map<string, Set<string>>()
  const byRegion = new Map<RegionId, NpcSect[]>()
  for (const s of sects) {
    const group = byRegion.get(s.regionId)
    if (group) group.push(s)
    else byRegion.set(s.regionId, [s])
  }
  for (const [region, group] of byRegion) {
    if (group.length < 2) continue
    const rng = mulberry32((hashString(`rivalry:${region}`) ^ seed) >>> 0)
    const order = [...group]
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (let i = 0; i < order.length; i++) {
      const a = order[i].id
      const b = order[(i + 1) % order.length].id
      if (a === b) continue
      ;(rivals.get(a) ?? rivals.set(a, new Set()).get(a)!).add(b)
      ;(rivals.get(b) ?? rivals.set(b, new Set()).get(b)!).add(a)
    }
  }
  return sects.map((s) => {
    const set = rivals.get(s.id)
    return set && set.size > 0 ? { ...s, rivalIds: [...set] } : s
  })
}

export interface FoundingProvinceOption {
  province: ProvinceDefinition
  sites: SectSiteDefinition[]
}

/**
 * The founding options for a given world seed (WORLD_PROCGEN_PLAN Wave 2). The world is now
 * generated from the seed, so the free-Poor pool comes from that seed's blueprint rather than a
 * static roster. `getBlueprintForSeed` is memoised, so the options, the eligibility check and the
 * committed world all read the identical generated blueprint.
 */
export function getFoundingOptions(seed: number): FoundingProvinceOption[] {
  const bp = getBlueprintForSeed(seed)
  const occupied = new Set(bp.npcSeeds.map((n) => n.seatSiteId))
  const sites = Object.values(bp.sites).filter((s) => s.tier === 'poor' && !occupied.has(s.id))
  return [{ province: bp.province, sites }]
}

export interface FoundingEligibility {
  canFound: boolean
  reason?: string
}

export function getFoundingEligibility(seed: number, provinceId: ProvinceId, sectSiteId: SectSiteId): FoundingEligibility {
  const bp = getBlueprintForSeed(seed)
  if (provinceId !== bp.province.id) {
    return { canFound: false, reason: 'This province cannot be chosen at founding.' }
  }
  const site = bp.sites[sectSiteId]
  if (!site) {
    return { canFound: false, reason: 'That site is not in the chosen province.' }
  }
  if (site.tier !== 'poor') {
    return { canFound: false, reason: 'Only a Poor site can be founded on.' }
  }
  if (bp.npcSeeds.some((n) => n.seatSiteId === sectSiteId)) {
    return { canFound: false, reason: 'That site is already held by another sect.' }
  }
  return { canFound: true }
}

/**
 * Creates the realm itself from a seed — blueprint, resource nodes, and the NPC roster on their
 * seats. Knows nothing about any player: a realm exists before anyone joins it (MULTIPLAYER_PLAN
 * §7.5), which is what lets a server open one on a schedule rather than have the first player
 * through the door generate it as a side effect of founding.
 *
 * Every prestige seat (Normal/Good) gets a live `NpcSect` plus a `LocationRuntime.ownerId`/`garrison`
 * entry. Poor seats are never seeded (§0.4) and get no entry at all — sparse storage already means
 * "no entry" = neutral (§2.2).
 */
export function createRealm(provinceId: ProvinceId, seed: number, now: number): WorldState {
  const blueprint = getBlueprintForSeed(seed)
  const npcDefs = blueprint.npcSeeds

  const locations: Record<string, LocationRuntime> = {}
  for (const npcDef of npcDefs) {
    locations[npcDef.seatSiteId] = {
      discovered: false,
      remainingCapacity: Infinity,
      lastVisitedAt: 0,
      visitCount: 0,
      ownerId: npcDef.id,
      outpostLevel: 0,
      knowledge: 0,
      flags: [],
      garrison: { strength: npcDef.strength },
    }
  }

  const npcSects: NpcSect[] = assignRivalries(
    npcDefs.map((def) => {
      // Jittered per-entity, seeded off the world seed + id so every sect starts on its own rhythm from turn one (§4.3).
      const rng = mulberry32((hashString(def.id) ^ seed) >>> 0)
      return {
        id: def.id,
        name: def.name,
        tier: def.tier,
        regionId: def.regionId,
        seatSiteId: def.seatSiteId,
        strength: def.strength,
        stockpile: { ...def.stockpile },
        aggression: def.aggression,
        status: 'active',
        nextActionAt: now + NPC_BASE_ACTION_INTERVAL_MS * (0.7 + rng() * 0.6),
        seatSince: now,
      }
    }),
    seed,
  )

  return {
    seed,
    blueprint,
    // Resource nodes are generated per territory from the blueprint (Wave 3), stored authoritatively.
    generatedNodes: { [provinceId]: generateTerritoryNodes(blueprint.territories, seed, WORLD_GEN_CONFIG) },
    locations,
    expeditions: [],
    npcSects,
  }
}

/**
 * Settles `sectId` onto a free seat in an existing realm (MULTIPLAYER_PLAN §7.5). Claims the seat in
 * the SHARED world and returns the joiner's own starting `provinces` alongside it — discovery is
 * per-player (§1), so it belongs to the sect, not the realm. The seat's defensive strength is derived
 * from the home roster (§4.1) and synced onto the runtime by `recomputeSeatStrength`, not written here.
 *
 * Validation is the caller's job via `getFoundingEligibility` — and once the realm is shared, the
 * claim has to be atomic server-side, since two players will pick the same free seat (§9).
 */
export function joinRealm(
  world: WorldState,
  sectId: SectId,
  provinceId: ProvinceId,
  sectSiteId: SectSiteId,
  now: number,
): { sectLocation: SectLocation; provinces: Record<ProvinceId, ProvinceRuntime>; world: WorldState } {
  return {
    sectLocation: { provinceId, sectSiteId, foundedAt: now },
    provinces: { [provinceId]: { discovered: true, surveyProgress: 0 } },
    world: {
      ...world,
      locations: {
        ...world.locations,
        [sectSiteId]: {
          discovered: true,
          remainingCapacity: Infinity,
          lastVisitedAt: now,
          visitCount: 1,
          ownerId: sectId,
          outpostLevel: 0,
          knowledge: 0,
          flags: [],
        },
      },
    },
  }
}

/**
 * Back-compat wrapper for the single-player founding path: create the realm, then join it. Wave 3
 * splits these at the call site (the server creates realms; a player joins one).
 */
export function buildInitialWorldState(
  provinceId: ProvinceId,
  sectSiteId: SectSiteId,
  seed: number,
  now: number,
  sectId: SectId = 'player',
): { sectLocation: SectLocation; provinces: Record<ProvinceId, ProvinceRuntime>; world: WorldState } {
  return joinRealm(createRealm(provinceId, seed, now), sectId, provinceId, sectSiteId, now)
}
