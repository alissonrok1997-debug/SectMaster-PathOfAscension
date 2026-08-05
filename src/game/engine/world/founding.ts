import type {
  GeneratedNodeRecord,
  LocationRuntime,
  NpcSect,
  ProvinceId,
  ProvinceRuntime,
  RegionId,
  SectLocation,
  SectSiteId,
  WorldState,
} from '../../types'
import { WORLD_DEF } from '../../data/world/worldDef'
import { getProvinceDef, type ProvinceDefinition } from '../../data/world/provinceDefs'
import { getSectSitesForProvince, type SectSiteDefinition } from '../../data/world/sectSiteDefs'
import { NPC_SECT_DEFS, getOccupiedPoorSeatIds } from '../../data/world/npcSectDefs'
import { getNeighbours } from '../../data/world/worldGraph'
import { generateProvinceNodes } from './worldGeneration'
import { NPC_BASE_ACTION_INTERVAL_MS, NPC_EMERGENCE_INTERVAL_MS } from './npcSimulation'
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

/** The provinces selectable at founding (§1.1), each offering only its free Poor sites. */
export function getFoundingOptions(): FoundingProvinceOption[] {
  const occupied = new Set(getOccupiedPoorSeatIds())
  return WORLD_DEF.foundingProvinceIds.map((id) => ({
    province: getProvinceDef(id),
    sites: getSectSitesForProvince(id).filter((s) => s.tier === 'poor' && !occupied.has(s.id)),
  }))
}

export interface FoundingEligibility {
  canFound: boolean
  reason?: string
}

export function getFoundingEligibility(provinceId: ProvinceId, sectSiteId: SectSiteId): FoundingEligibility {
  if (!WORLD_DEF.foundingProvinceIds.includes(provinceId)) {
    return { canFound: false, reason: 'This province cannot be chosen at founding.' }
  }
  const sites = getSectSitesForProvince(provinceId)
  const site = sites.find((s) => s.id === sectSiteId)
  if (!site) {
    return { canFound: false, reason: 'That site is not in the chosen province.' }
  }
  if (site.tier !== 'poor') {
    return { canFound: false, reason: 'Only a Poor site can be founded on.' }
  }
  if (getOccupiedPoorSeatIds().includes(sectSiteId)) {
    return { canFound: false, reason: 'That site is already held by another sect.' }
  }
  return { canFound: true }
}

/**
 * Builds the founding province's world state from a seed. Generates minor nodes
 * for the founding province and its neighbours (for map preview, §5.4) but marks
 * only the founding province `discovered` — ProvinceRuntime stays sparse (§2.2),
 * so neighbours have generated nodes without a runtime entry until visited.
 *
 * Also seeds the NPC-sect roster (FIRST_REALM_PLAN §4.4): every prestige seat
 * (Normal/Good) and a subset of Poor seats get a live `NpcSect` plus a
 * `LocationRuntime.ownerId`/`garrison` entry on their seat. Free Poor seats get
 * no entry at all — sparse storage already means "no entry" = neutral (§2.2).
 * The founding seat itself is written as player-owned; its defensive strength
 * is derived from the home disciple roster (§4.1), not stored here.
 */
export function buildInitialWorldState(
  provinceId: ProvinceId,
  sectSiteId: SectSiteId,
  seed: number,
  now: number,
): { sectLocation: SectLocation; world: WorldState } {
  const provinces: Record<ProvinceId, ProvinceRuntime> = {
    [provinceId]: { discovered: true, surveyProgress: 0 },
  }

  const generatedNodes: Record<ProvinceId, GeneratedNodeRecord[]> = {}
  for (const pid of [provinceId, ...getNeighbours(provinceId)]) {
    generatedNodes[pid] = generateProvinceNodes(pid, seed)
  }

  const locations: Record<string, LocationRuntime> = {}
  for (const npcDef of NPC_SECT_DEFS) {
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
  locations[sectSiteId] = {
    discovered: true,
    remainingCapacity: Infinity,
    lastVisitedAt: now,
    visitCount: 1,
    ownerId: 'player',
    outpostLevel: 0,
    knowledge: 0,
    flags: [],
  }

  const npcSects: NpcSect[] = assignRivalries(
    NPC_SECT_DEFS.map((def) => {
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

  const world: WorldState = {
    seed,
    provinces,
    locations,
    generatedNodes,
    expeditions: [],
    expeditionLog: [],
    npcSects,
    nextNpcEmergenceAt: now + NPC_EMERGENCE_INTERVAL_MS,
  }

  return { sectLocation: { provinceId, sectSiteId, foundedAt: now }, world }
}
