import type {
  GeneratedTerritory,
  LocationId,
  NpcSectTier,
  Resources,
  SectSiteId,
  SectSiteTier,
  SiteModifierBundle,
  WorldBlueprint,
} from '../../../types'
import type { SectSiteDefinition } from '../../../data/world/sectSiteDefs'
import type { NpcSectDefinition } from '../../../data/world/npcSectDefs'
import type { ResourceLocationDefinition } from '../../../data/world/landmarkDefs'
import { getProvinceDef } from '../../../data/world/provinceDefs'
import { REGION_IDENTITY } from '../../../data/world/regionIdentityDefs'
import { hashString, mulberry32, rollFloat, rollInt } from '../../rng'
import { generateGeometry, type SampledPoint } from './geometry'
import { createNamer } from './naming'
import { WORLD_GEN_CONFIG, type NpcArchetype, type SiteArchetype, type WorldGenConfig } from './worldGenConfig'

/**
 * The realm generator (WORLD_PROCGEN_PLAN Wave 2). `generateBlueprint(seed, config)` turns a seed
 * into a fresh `WorldBlueprint` — positions, region belts, tiers, names and ownership all vary per
 * seed, while counts/tiers/economy stay fixed by the config budgets. Modifier bundles and NPC stats
 * use the config's fixed representative-per-tier values; Wave 4 replaces those with rolled archetypes.
 *
 * Determinism: every stage draws from its own sub-stream `mulberry32(hashString(domain) ^ seed)`, so
 * the same seed reproduces the same blueprint and changing one stage never shifts another.
 */
export const GENERATED_GEN_VERSION = 4

const FIRST_REALM = 'firstRealm' as const
const TIER_WORD: Record<SectSiteTier, string> = { poor: 'quiet', normal: 'contested', good: 'coveted' }

function subStream(domain: string, seed: number): () => number {
  return mulberry32((hashString(domain) ^ seed) >>> 0)
}

/** Fisher–Yates over a copy, using the given RNG. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Closeness to the map centre — higher = more central. A true radial gradient (was `interiority`,
 * distance from the nearest edge, a rounded-rect one). Good seats want this high, Poor want it low. */
function centrality(x: number, y: number): number {
  return -Math.hypot(x - 0.5, y - 0.5)
}

/**
 * Assigns the 2 Good / 10 Normal / 20 Poor tiers: Good central & spaced, Poor edge-ward, Normal
 * between. The Heavenly Axis is forced to 2 good + 2 normal (its 4 seats), so the prize is
 * *guaranteed* at the heart rather than merely likely — with `tierBudget.good = 2` this also means
 * the rim never carries a Good seat.
 */
function placeTiers(
  seats: SampledPoint[],
  adjacency: number[][],
  config: WorldGenConfig,
): SectSiteTier[] {
  const tiers: SectSiteTier[] = new Array(seats.length)
  const central = (i: number) => centrality(seats[i].x, seats[i].y)

  // Force the Axis: its 4 seats become 2 good + 2 normal, the two most-central good.
  const axis = seats.map((_, i) => i).filter((i) => seats[i].regionId === 'heavenlyAxis').sort((a, b) => central(b) - central(a))
  const good: number[] = axis.slice(0, config.tierBudget.good)
  good.forEach((i) => (tiers[i] = 'good'))
  axis.slice(config.tierBudget.good).forEach((i) => (tiers[i] = 'normal'))

  // Fill any remaining Good budget from the rim, most-central first, keeping Good seats non-adjacent.
  for (const i of seats.map((_, k) => k).filter((k) => tiers[k] === undefined).sort((a, b) => central(b) - central(a))) {
    if (good.length >= config.tierBudget.good) break
    if (good.every((g) => !adjacency[g].includes(i))) {
      good.push(i)
      tiers[i] = 'good'
    }
  }

  // The untiered remainder splits Poor (most edge-ward) / Normal by the remaining budget.
  const rest = seats.map((_, i) => i).filter((i) => tiers[i] === undefined).sort((a, b) => central(a) - central(b))
  rest.forEach((i, rank) => (tiers[i] = rank < config.tierBudget.poor ? 'poor' : 'normal'))
  return tiers
}

/** Owner tier per seat (or null = free). Good→legendary, Normal→1 major + rest regional, 12/20 Poor→minor. */
function placeOwnership(
  tiers: SectSiteTier[],
  config: WorldGenConfig,
  rng: () => number,
): (NpcSectTier | null)[] {
  const owners: (NpcSectTier | null)[] = new Array(tiers.length).fill(null)
  const idx = (t: SectSiteTier) => tiers.map((tt, i) => (tt === t ? i : -1)).filter((i) => i >= 0)

  for (const i of idx('good')) owners[i] = 'legendary'

  const normals = shuffle(idx('normal'), rng)
  normals.forEach((i, k) => (owners[i] = k < config.npcTierBudget.major ? 'major' : 'regional'))

  // Poor seats are NEVER seeded with an NPC (MULTIPLAYER_PLAN §0.4): they are the player founding
  // and fallback pool, exclusively. Every Poor seat stays null — i.e. free — at realm creation.
  return owners
}

/** Rolls a site's building-slot cap, modifier bundle and optional starting bonus within its tier archetype (Wave 4). */
function rollSite(
  rng: () => number,
  arch: SiteArchetype,
  productionResource: keyof Resources,
): { buildingSlots: number; modifiers: SiteModifierBundle; startingBonus?: Partial<Resources> } {
  const modifiers: SiteModifierBundle = {
    cultivationSpeedMult: rollFloat(rng, arch.cultivationSpeedMult),
    productionMultByResource: {},
    defenceMult: rollFloat(rng, arch.defenceMult),
    travelTimeMult: 1,
    recruitmentRateMult: 1,
    upkeepMult: 1,
    buildTimeMult: 1,
  }
  const production = rollFloat(rng, arch.productionMult)
  if (production > 1.001) modifiers.productionMultByResource = { [productionResource]: production }
  // Each secondary mult is an independent coin-flip, so most seats carry one or two, not all.
  if (arch.recruitmentRateMult && rng() < arch.secondaryChance) modifiers.recruitmentRateMult = rollFloat(rng, arch.recruitmentRateMult)
  if (arch.upkeepMult && rng() < arch.secondaryChance) modifiers.upkeepMult = rollFloat(rng, arch.upkeepMult)
  if (arch.buildTimeMult && rng() < arch.secondaryChance) modifiers.buildTimeMult = rollFloat(rng, arch.buildTimeMult)

  const buildingSlots = rollInt(rng, arch.buildingSlots)
  const startingBonus =
    arch.startingBonus && rng() < arch.startingBonus.chance
      ? { [productionResource]: rollInt(rng, arch.startingBonus.range) }
      : undefined
  return { buildingSlots, modifiers, startingBonus }
}

/** Rolls an NPC sect's stats within its owner-tier archetype (Wave 4). */
function rollNpcStats(rng: () => number, arch: NpcArchetype): { strength: number; stockpile: Partial<Resources>; aggression: number } {
  const stockpile: Partial<Resources> = {}
  for (const [key, range] of Object.entries(arch.stockpile) as [keyof Resources, { min: number; max: number }][]) {
    stockpile[key] = rollInt(rng, range)
  }
  return { strength: rollInt(rng, arch.strength), stockpile, aggression: rollFloat(rng, arch.aggression) }
}

function tryGenerate(effectiveSeed: number, storedSeed: number, config: WorldGenConfig): WorldBlueprint {
  const geometry = generateGeometry(subStream('geometry', effectiveSeed), config)
  const seats = geometry.points
  const ids: SectSiteId[] = seats.map((_, i) => `t${String(i).padStart(2, '0')}`)

  const tiers = placeTiers(seats, geometry.adjacency, config)
  const owners = placeOwnership(tiers, config, subStream('ownership', effectiveSeed))
  const namer = createNamer(subStream('names', effectiveSeed), config)

  const sites: Record<SectSiteId, SectSiteDefinition> = {}
  const territories: GeneratedTerritory[] = []
  const npcSeeds: NpcSectDefinition[] = []

  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i]
    const tier = tiers[i]
    const name = namer.nameTerritory(seat.regionId, tier)
    // Per-seat sub-stream so a seat's roll is stable and independent of every other seat's.
    const rolled = rollSite(subStream(`modifiers:${ids[i]}`, effectiveSeed), config.tierArchetypes[tier], config.regionProductionResource[seat.regionId])

    sites[ids[i]] = {
      id: ids[i],
      name,
      description: `${name} — a ${TIER_WORD[tier]} seat among the ${REGION_IDENTITY[seat.regionId].temperament}.`,
      tier,
      regionId: seat.regionId,
      conquerable: tier !== 'poor',
      mapPosition: { x: seat.x, y: seat.y },
      buildingSlots: rolled.buildingSlots,
      modifiers: rolled.modifiers,
      travelUnitOffset: Math.min(3, Math.round(seat.x * 3)),
      startingBonus: rolled.startingBonus,
    }

    territories.push({
      id: ids[i],
      name,
      regionId: seat.regionId,
      tier,
      seat: { x: seat.x, y: seat.y },
      neighbours: geometry.adjacency[i].map((n) => ids[n]),
      spiritVeinTier: config.veinTier,
      polygon: geometry.polygons[i],
    })

    const ownerTier = owners[i]
    if (ownerTier) {
      const stats = rollNpcStats(subStream(`npcstats:${ids[i]}`, effectiveSeed), config.npcArchetypes[ownerTier])
      npcSeeds.push({
        id: `npc-${ids[i]}`,
        name: namer.nameSect(),
        tier: ownerTier,
        regionId: seat.regionId,
        seatSiteId: ids[i],
        strength: stats.strength,
        stockpile: stats.stockpile,
        aggression: stats.aggression,
      })
    }
  }

  // Resource nodes live in `world.generatedNodes` (Wave 3), generated per territory at founding —
  // the blueprint carries none. (`buildLegacyBlueprint` still packs authored landmarks for old saves.)
  const nodes: Record<LocationId, ResourceLocationDefinition> = {}

  const baseProvince = getProvinceDef(FIRST_REALM)
  return {
    seed: storedSeed,
    genVersion: GENERATED_GEN_VERSION,
    territories,
    sites,
    nodes,
    npcSeeds,
    province: { ...baseProvince, sectSiteIds: ids, landmarkIds: Object.keys(nodes) },
  }
}

/** Invariants (WORLD_PROCGEN_PLAN §invariants) the generator must satisfy; returns the list of failures. */
export function validateBlueprint(bp: WorldBlueprint, config: WorldGenConfig): string[] {
  const errors: string[] = []
  const tiers = bp.territories.map((t) => t.tier)
  const count = (t: SectSiteTier) => tiers.filter((x) => x === t).length
  if (count('good') !== config.tierBudget.good) errors.push(`good=${count('good')}`)
  if (count('normal') !== config.tierBudget.normal) errors.push(`normal=${count('normal')}`)
  if (count('poor') !== config.tierBudget.poor) errors.push(`poor=${count('poor')}`)

  const regionsPresent = new Set(bp.territories.map((t) => t.regionId))
  if (regionsPresent.size !== config.regions.length) errors.push(`regions=${regionsPresent.size}`)

  const owned = new Set(bp.npcSeeds.map((n) => n.seatSiteId))
  const freePoor = bp.territories.filter((t) => t.tier === 'poor' && !owned.has(t.id)).length
  if (freePoor < config.foundingFreePoorMin) errors.push(`freePoor=${freePoor}`)

  // The Heavenly Axis is the guaranteed central prize: all 4 seats are Good (legendary), no Normal/Poor.
  const axis = bp.territories.filter((t) => t.regionId === 'heavenlyAxis')
  const axisGood = axis.filter((t) => t.tier === 'good').length
  if (axisGood !== 4) errors.push(`axisTiers=${axisGood}g/${axis.length - axisGood}n`)
  // Founding seats the player on a free Poor seat, and those must all sit on the rim (never the Axis).
  const axisFreePoor = bp.territories.filter((t) => t.regionId === 'heavenlyAxis' && t.tier === 'poor' && !owned.has(t.id)).length
  if (axisFreePoor > 0) errors.push(`axisFreePoor=${axisFreePoor}`)

  // Territory adjacency (the Delaunay dual): no self-loops, undirected (symmetric), and connected.
  const byId = new Map(bp.territories.map((t) => [t.id, t]))
  const nbSet = new Map(bp.territories.map((t) => [t.id, new Set(t.neighbours)]))
  for (const t of bp.territories) {
    if (t.neighbours.includes(t.id)) errors.push(`selfEdge:${t.id}`)
    for (const n of t.neighbours) {
      if (!byId.has(n)) errors.push(`danglingEdge:${t.id}->${n}`)
      else if (!nbSet.get(n)!.has(t.id)) errors.push(`asymEdge:${t.id}->${n}`)
    }
  }
  const seen = new Set<SectSiteId>([bp.territories[0].id])
  const queue = [bp.territories[0].id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const n of byId.get(cur)?.neighbours ?? []) if (!seen.has(n)) (seen.add(n), queue.push(n))
  }
  if (seen.size !== bp.territories.length) errors.push(`connected=${seen.size}/${bp.territories.length}`)

  const names = bp.territories.map((t) => t.name)
  if (new Set(names).size !== names.length) errors.push('duplicate territory names')

  // "Balanced seed" filter (Wave 4): every rolled site/NPC stays within its archetype bounds — no
  // trivial or unbeatable outliers. Rolls are bounded by construction, so this is a safety net.
  const within = (v: number, r: { min: number; max: number }) => v >= r.min - 1e-6 && v <= r.max + 1e-6
  for (const site of Object.values(bp.sites)) {
    const arch = config.tierArchetypes[site.tier]
    const prodRes = config.regionProductionResource[site.regionId]
    const prod = site.modifiers.productionMultByResource[prodRes] ?? 1
    if (!within(site.buildingSlots, arch.buildingSlots)) errors.push(`slots:${site.id}`)
    if (!within(site.modifiers.cultivationSpeedMult, arch.cultivationSpeedMult)) errors.push(`cult:${site.id}`)
    if (!within(site.modifiers.defenceMult, arch.defenceMult)) errors.push(`def:${site.id}`)
    if (prod > 1.001 && !within(prod, arch.productionMult)) errors.push(`prod:${site.id}`)
  }
  for (const npc of bp.npcSeeds) {
    const arch = config.npcArchetypes[npc.tier]
    if (!within(npc.strength, arch.strength)) errors.push(`str:${npc.id}`)
    if (!within(npc.aggression, arch.aggression)) errors.push(`aggr:${npc.id}`)
  }
  return errors
}

export function generateBlueprint(seed: number, config: WorldGenConfig = WORLD_GEN_CONFIG): WorldBlueprint {
  // Invariants hold by construction; the reroll loop is a safety net for pathological Voronoi cases.
  for (let attempt = 0; attempt < 8; attempt++) {
    const effectiveSeed = attempt === 0 ? seed : ((seed + attempt * 0x9e3779b1) >>> 0)
    const bp = tryGenerate(effectiveSeed, seed, config)
    if (validateBlueprint(bp, config).length === 0) return bp
  }
  throw new Error(`generateBlueprint: could not satisfy invariants for seed ${seed}`)
}

/** Memoises the last seed→blueprint so the founding screen (options, eligibility, commit) all agree. */
let cache: { seed: number; bp: WorldBlueprint } | null = null
export function getBlueprintForSeed(seed: number): WorldBlueprint {
  if (cache && cache.seed === seed) return cache.bp
  const bp = generateBlueprint(seed, WORLD_GEN_CONFIG)
  cache = { seed, bp }
  return bp
}
