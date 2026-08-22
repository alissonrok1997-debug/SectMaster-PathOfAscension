import { useGameStore } from '../game/state/store'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { getUpgradeEligibility } from '../game/engine/upgradeEligibility'
import { computeSectRank } from '../game/engine/sectRank'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { RESOURCE_ART, SECT_HALL_PLATE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { getBuildingMetaLine } from './buildingRowMeta'
import { formatCountdown, formatDurationAdaptive } from '../game/utils/formatDuration'
import type { Resources } from '../game/types'

/**
 * THE SCREEN'S ONE PEAK — permanently the Sect Hall.
 *
 * Disciples rotates its plate because disciples are peers. Buildings does not, because they
 * are not: no building may be raised above the Sect Hall's level, the Hall carries the sect
 * rank, and `Cannot exceed the Sect Hall's level` is the most-shown blocked reason in the
 * whole system. §0's intent — the plate is never empty and it points at the decision that
 * matters — is met by a different mechanism. Recorded as deviation 2.
 *
 * FRAMELESS, by OMA 2026-08-16. `plaque-frame.png` is not used here: the hall stands on the
 * paper behind the gold wash, which is the roll card's treatment (§16.2 — "no frame at all,
 * the figure stands on the paper behind a grade-coloured halo"), not the plate's own. The
 * arch clipped the upswept eaves at any size worth using, and dropping it let the
 * illustration grow from 118x151 to 153x153.
 */
export function BuildingPlate({ onSelect }: { onSelect: (id: string) => void }) {
  const state = useGameStore((s) => s.state)
  const def = getBuildingDef(SECT_HALL_ID)
  const hall = state.buildings[SECT_HALL_ID]
  if (!hall) return null

  const eligibility = getUpgradeEligibility(state, SECT_HALL_ID)
  const rank = computeSectRank(hall.level)
  const isRaising = hall.constructionEndsAt !== undefined
  const remainingMs = Math.max(0, (hall.constructionEndsAt ?? 0) - Date.now())
  const costEntries = Object.entries(eligibility.cost) as [keyof Resources, number][]

  return (
    <button type="button" className="works-plate" onClick={() => onSelect(SECT_HALL_ID)}>
      <img className="works-plate-art" src={SECT_HALL_PLATE_ART} alt="" width={153} height={153} draggable={false} />
      <span className="works-plate-text">
        <span className="works-plate-name">{def.name}</span>
        <span className="works-plate-pill">{def.category}</span>
        <span className="works-plate-effect">
          {isRaising ? `Raising to Level ${hall.level + 1}` : getBuildingMetaLine(state, SECT_HALL_ID)}
        </span>

        {/*
         * The bar slot carries the cost when idle and the construction bar when raising.
         * §8's plate always shows a bar; the Sect Hall is usually not building, and a bar
         * that only exists sometimes leaves a hole where the decision should be. Recorded
         * as deviation 3.
         */}
        {isRaising ? (
          <span className="progress-bar works-plate-bar">
            <span
              className="progress-bar-fill construction"
              style={{
                width: `${Math.min(100, Math.max(0, 100 - (remainingMs / (eligibility.durationMs || 1)) * 100))}%`,
              }}
            />
          </span>
        ) : (
          <span className="works-plate-cost">
            {costEntries.map(([key, amount]) => (
              <span className="works-plate-cost-chip" key={key}>
                <GameIcon src={RESOURCE_ART[key]} alt="" size={14} />
                {amount} {RESOURCE_LABELS[key]}
              </span>
            ))}
          </span>
        )}

        <span className="works-plate-foot">
          <span className="works-plate-rank">{rank.name}</span>
          <span className="works-plate-time">
            {isRaising
              ? `${formatCountdown(remainingMs)} remaining`
              : `Raises in ${formatDurationAdaptive(eligibility.durationMs / 1000)}`}
          </span>
        </span>
      </span>
    </button>
  )
}
