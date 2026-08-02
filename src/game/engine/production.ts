import { createEmptyResources, type GameState, type Resources } from '../types'
import { BUILDING_DEFS, SECT_HALL_ID } from '../data/buildingDefs'
import { computeStorageCaps } from './storage'
import { QI_PRODUCTION_PENALTY_MULTIPLIER } from './cultivationBoost'
import { getDoctrineModifiers } from './doctrine'
import { getWorldModifiers } from './world/worldModifiers'

/** A Scholar assigned to the Library improves its Knowledge output (doc 03 — Scholar "Improves Library and Research Institute output"). */
const SCHOLAR_LIBRARY_BONUS = 1.3

/** Current per-second production rate for every resource, factoring in the Over-Level Penalty, the Active Cultivation Boost's Qi Stone penalty, an assigned Scholar's Library bonus, Sect Doctrine, and the aggregated world-map modifiers (sect site + Spirit Vein + active World Event + owned outposts, via getWorldModifiers) — but not the storage cap, since a rate display shouldn't silently drop to 0 right at the cap. */
export function computeProductionRatesPerSecond(state: GameState): Resources {
  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  const qiPenaltyActive = (state.qiStoneProductionPenaltyUntil ?? 0) > Date.now()
  const doctrineMods = getDoctrineModifiers(state)
  const worldMods = getWorldModifiers(state)
  const hasLibraryScholar = state.disciples.some((d) => d.role === 'Scholar' && d.assignedBuildingId === 'library')
  const rates = createEmptyResources()

  for (const def of BUILDING_DEFS) {
    if (!def.produces || !def.baseRatePerLevel) continue
    const building = state.buildings[def.id]
    if (!building) continue

    const overLevelPenalty = building.level > hallLevel ? 0.5 : 1
    const boostPenalty = def.id === 'sacredMountainShrine' && qiPenaltyActive ? QI_PRODUCTION_PENALTY_MULTIPLIER : 1
    const scholarBonus = def.id === 'library' && hasLibraryScholar ? SCHOLAR_LIBRARY_BONUS : 1
    const knowledgeDoctrineBonus = def.produces === 'knowledge' ? doctrineMods.knowledgeMult : 1
    // Owned-outpost production bonuses (the absorbed Wave-7 territories) now arrive
    // through worldMods.productionMultByResource (getWorldModifiers), not a separate lookup.
    const worldBonus = worldMods.productionMultByResource[def.produces] ?? 1
    rates[def.produces] +=
      def.baseRatePerLevel *
      building.level *
      overLevelPenalty *
      boostPenalty *
      scholarBonus *
      doctrineMods.productionMult *
      knowledgeDoctrineBonus *
      worldBonus
  }

  return rates
}

/**
 * Layer 1 continuous production (doc 09, Section 3). Applies the Sect
 * Hall's Over-Level Penalty (doc 02, Section 3: -50% output for any
 * building above the Hall's level), the Active Cultivation Boost's Qi
 * Stone production penalty (doc 01, Section 2), and clamps to each
 * resource's storage cap rather than letting it silently overflow.
 */
export function applyProductionTick(state: GameState, deltaMs: number): Resources {
  const caps = computeStorageCaps(state)
  const deltaSeconds = deltaMs / 1000
  const rates = computeProductionRatesPerSecond(state)
  const next = { ...state.resources }

  for (const key of Object.keys(rates) as (keyof Resources)[]) {
    next[key] = Math.min(caps[key], next[key] + rates[key] * deltaSeconds)
  }

  return next
}
