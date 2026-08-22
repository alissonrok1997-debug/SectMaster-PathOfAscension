import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { AssignDiscipleModal } from './AssignDiscipleModal'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { getUpgradeEligibility } from '../game/engine/upgradeEligibility'
import { getBuildingSlotCount } from '../game/engine/buildingAssignment'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { BUILDING_ART, RESOURCE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { UiIcon } from './UiIcon'
// Moved to a shared component-level module so the sheet and the works row cannot drift.
import { getBuildingEffectRows, getBuildingRatePerSecond } from './buildingRowMeta'
import { formatCountdown, formatDurationAdaptive } from '../game/utils/formatDuration'
import type { Resources } from '../game/types'

/**
 * The building sheet, on paper.
 *
 * Converted 2026-08-16, after the Buildings screen migrated: the screen was parchment and the
 * sheet you tapped into from it was still the old dark `dl`/`ul` stack, which is the most
 * visible seam a half-migrated screen can have.
 *
 * IT REUSES THE LEAF'S VOCABULARY RATHER THAN INVENTING A THIRD SHEET LANGUAGE. `.leaf-stat`
 * for the figures, `.leaf-row` for anything tappable, `.works-plate-cost-chip` for a cost —
 * all of it already shipped for the disciple leaf and the Buildings screen. The mount is
 * `panelClassName="parchment leaf"` from `BuildingList`: `.parchment` carries the token
 * ladder, `.leaf` carries the material and the dark→paper remap that keeps un-migrated rules
 * (`.panel-hint`, the buttons) resolving to paper values.
 *
 * Two structural changes fall out of that, both deletions:
 *
 *   - The `dl`/`ul` stacks are gone. Figures are a `.leaf-standing` strip; costs are chips.
 *   - The 2-up work-slot tile grid is gone, replaced by `.leaf-row`s. That removes the LAST
 *     consumer of `.building-tile`, so the class and its CSS go with it.
 */
export function BuildingDetailPanel({ buildingId }: { buildingId: string }) {
  // Subscribing to the whole state so the construction countdown re-renders every tick.
  const state = useGameStore((s) => s.state)
  const startUpgrade = useGameStore((s) => s.startUpgrade)
  const assignDisciple = useGameStore((s) => s.assignDisciple)
  const demolishSpecializationBuilding = useGameStore((s) => s.demolishSpecializationBuilding)
  const [assignPickerOpen, setAssignPickerOpen] = useState(false)

  const building = state.buildings[buildingId]
  const def = getBuildingDef(buildingId)

  if (!building) return null
  const hallLevel = state.buildings[SECT_HALL_ID]?.level ?? 1
  const isOverLevel = buildingId !== SECT_HALL_ID && building.level > hallLevel

  const isConstructing = building.constructionEndsAt !== undefined
  const eligibility = getUpgradeEligibility(state, buildingId)
  const qiPenaltyActive =
    buildingId === 'sacredMountainShrine' && (state.qiStoneProductionPenaltyUntil ?? 0) > Date.now()
  const currentRate = getBuildingRatePerSecond(state, buildingId)
  const nextRate = def.produces ? def.baseRatePerLevel! * (building.level + 1) : 0

  const assignedDisciples = state.disciples.filter((d) => d.assignedBuildingId === buildingId)
  const slotCount = getBuildingSlotCount(building.level)
  const emptySlots = Math.max(0, slotCount - assignedDisciples.length)
  const canAssign = buildingId !== SECT_HALL_ID
  const costEntries = Object.entries(eligibility.cost) as [keyof Resources, number][]
  const effectRows = getBuildingEffectRows(buildingId, building.level, state)

  return (
    <div className={`building-leaf ${isOverLevel ? 'over-level' : ''}`}>
      {/* The identity block. Not a `.works-plate` — the plate carries a 153px illustration
          and only the Sect Hall has one; every other building has a 48px mark. So the sheet
          takes the same type scale at the size the art can actually support. */}
      <div className="building-leaf-head">
        <GameIcon className="building-leaf-art" src={BUILDING_ART[buildingId]} fallback="🏯" alt="" size={72} />
        <div className="building-leaf-ident">
          <h3>{def.name}</h3>
          <span className="works-plate-pill">{def.category}</span>
          <span className="building-leaf-level">Level {building.level}</span>
        </div>
      </div>

      <p className="building-leaf-lore">{def.description}</p>

      {/* WHAT IT DOES — the `dl` becomes a stat strip. Two or three figures side by side read
          faster than four label/value rows, and it is the leaf's existing shape.
          A building with neither a rate nor an effect row (Forge, Alchemy Workshop, Research
          Institute) has no figures, so it gets no strip: the earlier fallback put its work
          slots here and the Work slots section below then said the same thing again. */}
      {(def.produces || effectRows.length > 0) && (
      <div className="leaf-standing">
        {effectRows.slice(0, 2).map((row) => (
          <div className="leaf-stat" key={row.label}>
            <span className="leaf-stat-label">{row.label}</span>
            <span className="leaf-stat-value">{row.value}</span>
          </div>
        ))}
        {def.produces && (
          <>
            <div className="leaf-stat">
              <span className="leaf-stat-label">Production</span>
              <span className={`leaf-stat-value ${isOverLevel || qiPenaltyActive ? 'bad' : ''}`}>
                +{currentRate.toFixed(2)}/s
              </span>
            </div>
            <div className="leaf-stat">
              <span className="leaf-stat-label">At Level {building.level + 1}</span>
              <span className="leaf-stat-value">+{nextRate.toFixed(2)}/s</span>
            </div>
          </>
        )}
      </div>
      )}
      {def.produces && (
        <p className="leaf-standing-note">
          Per second, in {RESOURCE_LABELS[def.produces]}.
        </p>
      )}

      {isOverLevel && (
        <p className="building-leaf-warn">Over-Level Penalty active: -50% output (above Sect Hall level)</p>
      )}
      {qiPenaltyActive && (
        <p className="building-leaf-warn">
          Qi Stone output halved &mdash; reserve is feeding an Active Cultivation Boost
        </p>
      )}

      {/* WHAT IT COSTS — the `ul` becomes the cost chips the plate already uses, so a price
          looks the same everywhere in the game. */}
      <p className="leaf-section-title">To raise it to Level {eligibility.targetLevel}</p>
      <div className="works-plate-cost building-leaf-cost">
        {costEntries.map(([key, amount]) => (
          <span className="works-plate-cost-chip" key={key}>
            <GameIcon src={RESOURCE_ART[key]} alt="" size={14} />
            {amount} {RESOURCE_LABELS[key]}
          </span>
        ))}
        <span className="works-plate-cost-chip">{formatDurationAdaptive(eligibility.durationMs / 1000)} of work</span>
      </div>

      {/* WHO WORKS IT — `.leaf-row`s, the same "tap to change this" shape the disciple leaf
          uses for Posting and equipment. The 2-up tile grid is gone. */}
      {canAssign && (
        <>
          <p className="leaf-section-title">
            Work slots ({assignedDisciples.length} / {slotCount})
            {buildingId === 'trainingHall' ? ' — cultivate faster here' : ''}
          </p>
          {assignedDisciples.map((d) => (
            <button key={d.id} type="button" className="leaf-row" onClick={() => assignDisciple(d.id, undefined)}>
              <span className="leaf-row-text">
                <span className="leaf-row-label">Posted</span>
                <span className="leaf-row-value">{d.name}</span>
              </span>
              <span className="leaf-row-release">Release</span>
            </button>
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              className="leaf-row leaf-row-empty"
              onClick={() => setAssignPickerOpen(true)}
            >
              <span className="leaf-row-text">
                <span className="leaf-row-label">Empty</span>
                <span className="leaf-row-value">Assign a disciple</span>
              </span>
              <UiIcon className="leaf-row-chevron" name="chevron" size={20} />
            </button>
          ))}
        </>
      )}

      {assignPickerOpen && (
        <AssignDiscipleModal buildingId={buildingId} onClose={() => setAssignPickerOpen(false)} />
      )}

      {isConstructing ? (
        <div className="building-leaf-progress">
          <span className="progress-bar works-plate-bar">
            <span
              className="progress-bar-fill construction"
              style={{
                width: `${Math.min(
                  100,
                  100 - ((building.constructionEndsAt! - Date.now()) / (eligibility.durationMs || 1)) * 100,
                )}%`,
              }}
            />
          </span>
          <p className="leaf-standing-note">
            Raising to Level {building.level + 1} &middot; {formatCountdown(building.constructionEndsAt! - Date.now())}{' '}
            remaining
          </p>
        </div>
      ) : (
        <>
          <button
            className="roster-action primary"
            disabled={!eligibility.canUpgrade}
            onClick={() => startUpgrade(buildingId)}
          >
            Upgrade to Lv{eligibility.targetLevel}
          </button>
          {!eligibility.canUpgrade && eligibility.reason && (
            <p className="leaf-standing-note">{eligibility.reason}</p>
          )}
        </>
      )}

      {def.slotType === 'specialization' && !isConstructing && (
        <button
          type="button"
          className="building-leaf-demolish"
          onClick={() => {
            if (window.confirm(`Demolish ${def.name}? Its levels are lost and its slot frees up for a different specialization.`)) {
              demolishSpecializationBuilding(buildingId)
            }
          }}
        >
          Demolish
        </button>
      )}
    </div>
  )
}
