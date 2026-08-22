/**
 * The one line of information a building row carries under its name — and the effect rows
 * the detail sheet has always shown.
 *
 * WHY THIS LIVES IN `components/` AND NOT IN `engine/`. Everything here returns *display
 * strings*, not game values: it decides what a row says, never what a building does.
 * CLAUDE.md forbids touching the engine for a visual reason, and `breakthroughChannel.ts`
 * and `useValueFlash.ts` are the existing precedent for a shared component-level module.
 * The derivations underneath — caps, capacity, slot counts, rates — all stay in the engine
 * where they already are; this only phrases them.
 *
 * `getBuildingEffectRows` moved here verbatim from `BuildingDetailPanel`, which now imports
 * it, so the sheet and the row cannot drift apart.
 */
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { computeStorageCaps } from '../game/engine/storage'
import { computeDiscipleCapacity } from '../game/engine/discipleCapacity'
import { getAssignedDiscipleCount, getBuildingSlotCount } from '../game/engine/buildingAssignment'
import { TRAINING_HALL_RATE_PER_LEVEL } from '../game/engine/cultivation'
import {
  BOOST_COST,
  BOOST_DURATION_MS,
  BOOST_RATE_PER_SECOND,
  QI_PRODUCTION_PENALTY_MULTIPLIER,
} from '../game/engine/cultivationBoost'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import type { GameState, Resources } from '../game/types'

/** Building-specific "Current effects" rows for buildings whose value isn't a resource-per-second production number. */
export function getBuildingEffectRows(
  buildingId: string,
  level: number,
  state: GameState,
): { label: string; value: string }[] {
  switch (buildingId) {
    case 'warehouse': {
      const caps = computeStorageCaps(state)
      return [
        { label: 'Raw material cap', value: Math.round(caps.spiritWood).toLocaleString() },
        { label: 'Knowledge cap', value: Math.round(caps.knowledge).toLocaleString() },
      ]
    }
    case 'dormitory':
      return [
        {
          label: 'Disciple capacity',
          value: `${state.disciples.length} / ${computeDiscipleCapacity(state.buildings)}`,
        },
      ]
    case 'trainingHall':
      /*
       * PER HOUR, not per second — this row read `+0.0 pts/s each` at every level in the
       * game's whole history. TRAINING_HALL_RATE_PER_LEVEL is 0.0001473 (percent of a
       * sub-realm per second), so `.toFixed(1)` of it is 0.0 for any level a player will
       * ever reach. The constant is untouched; only the unit it is quoted in changes, and
       * an hour is the scale a cultivation rate is actually felt at.
       */
      return [
        {
          label: 'Cultivation, assigned',
          value: `+${(TRAINING_HALL_RATE_PER_LEVEL * level * 3600).toFixed(2)}%/hr each`,
        },
      ]
    case 'trainingGround': {
      const cost = (Object.entries(BOOST_COST) as [keyof Resources, number][])
        .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
        .join(', ')
      return [
        { label: 'Boost rate', value: `+${BOOST_RATE_PER_SECOND.toFixed(1)} pts/s` },
        { label: 'Boost duration', value: `${Math.round(BOOST_DURATION_MS / 1000)}s` },
        { label: 'Boost cost', value: cost },
      ]
    }
    default:
      return []
  }
}

/**
 * A building's own production rate, with the two penalties that can apply to it.
 *
 * Extracted from `BuildingDetailPanel`, which computed this inline, so the row and the sheet
 * quote the same number. `computeProductionRatesPerSecond` cannot be used here — it returns
 * the sect's totals per resource, and two buildings can feed the same resource.
 */
export function getBuildingRatePerSecond(state: GameState, buildingId: string): number {
  const def = getBuildingDef(buildingId)
  const building = state.buildings[buildingId]
  if (!building || !def.produces || !def.baseRatePerLevel) return 0

  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  const overLevel = buildingId !== SECT_HALL_ID && building.level > hallLevel ? 0.5 : 1
  const qiPenalty =
    buildingId === 'sacredMountainShrine' && (state.qiStoneProductionPenaltyUntil ?? 0) > Date.now()
      ? QI_PRODUCTION_PENALTY_MULTIPLIER
      : 1

  return def.baseRatePerLevel * building.level * overLevel * qiPenalty
}

/**
 * The description reduced to its opening clause, for buildings that have neither a rate nor
 * an effect row (Forge, Alchemy Workshop, Research Institute).
 *
 * Cut at the first comma, stop, semicolon or em-dash rather than at a raw character count:
 * "Brews pills, and crafts accessories and manuals." yields "Brews pills", where a blind
 * truncation would cut mid-phrase.
 */
/** Longest description clause a row can carry before the staffing suffix loses its place. */
const CLAUSE_MAX = 28

function openingClause(description: string): string {
  const cut = description.search(/[,.;—]/)
  const clause = cut === -1 ? description : description.slice(0, cut)
  if (clause.length <= CLAUSE_MAX) return clause
  /*
   * Truncate HERE rather than leaving it to the CSS ellipsis. The metadata line is one
   * string — description plus ` · 0 / 1 worked` — so an ellipsis at the element's edge eats
   * the staffing fraction off the end and the row silently loses information. The Forge
   * rendered as "Smiths weapons and armor from Iron Essence and Spir…" with its work slots
   * gone. Cut on a word boundary so the phrase still reads.
   */
  const clipped = clause.slice(0, CLAUSE_MAX)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

/**
 * The row's metadata line: the most useful thing the model can say about this building,
 * plus its staffing when it has any.
 *
 * The order is deliberate — a rate is what a production building is *for*, an effect row is
 * what a support building is for, and the description is the fallback for the rest. The Sect
 * Hall is special-cased because its actual function is the constraint it places on every
 * other building, which no other field states.
 */
export function getBuildingMetaLine(state: GameState, buildingId: string): string {
  const def = getBuildingDef(buildingId)
  const building = state.buildings[buildingId]
  if (!building) return ''

  const parts: string[] = []

  if (buildingId === SECT_HALL_ID) {
    parts.push(`Caps every building at Level ${building.level}`)
  } else if (def.produces) {
    parts.push(`+${getBuildingRatePerSecond(state, buildingId).toFixed(2)} ${RESOURCE_LABELS[def.produces]}/s`)
  } else {
    const [first] = getBuildingEffectRows(buildingId, building.level, state)
    parts.push(first ? `${first.label} ${first.value}` : openingClause(def.description))
  }

  // The Sect Hall takes no assignments, so it never carries a staffing fraction.
  if (buildingId !== SECT_HALL_ID) {
    parts.push(`${getAssignedDiscipleCount(state, buildingId)} / ${getBuildingSlotCount(building.level)} worked`)
  }

  return parts.join(' · ')
}

/**
 * The row's foot line — shown ONLY when there is something to say, per §11's rule for the
 * condition bar generalised: a row in its ordinary state says nothing.
 *
 * ⚠ This is deliberately NOT `getUpgradeEligibility(...).reason`. That function tests the
 * construction queue first, so while anything is building every row would return
 * "Construction queue is busy…" and the building-specific blocker would never surface. The
 * queue is a fact about the sect and is stated once, under the plate.
 */
export function getBuildingHoldLine(state: GameState, buildingId: string): string | undefined {
  const building = state.buildings[buildingId]
  if (!building || buildingId === SECT_HALL_ID) return undefined
  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  if (building.level > hallLevel) return 'Over the Sect Hall’s level — output halved'
  if (building.level === hallLevel) return 'Held at the Sect Hall’s level'
  return undefined
}
