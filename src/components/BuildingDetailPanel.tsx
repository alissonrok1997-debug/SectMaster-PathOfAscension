import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { AssignDiscipleModal } from './AssignDiscipleModal'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import { getUpgradeEligibility } from '../game/engine/upgradeEligibility'
import { computeStorageCaps } from '../game/engine/storage'
import { computeDiscipleCapacity } from '../game/engine/discipleCapacity'
import { getBuildingSlotCount } from '../game/engine/buildingAssignment'
import { TRAINING_HALL_RATE_PER_LEVEL } from '../game/engine/cultivation'
import { BOOST_COST, BOOST_DURATION_MS, BOOST_RATE_PER_SECOND } from '../game/engine/cultivationBoost'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatCountdown, formatDurationAdaptive } from '../game/utils/formatDuration'
import type { GameState, Resources } from '../game/types'

/** Building-specific "Current effects" rows for buildings whose value isn't a resource-per-second production number. */
function getBuildingEffectRows(buildingId: string, level: number, state: GameState): { label: string; value: string }[] {
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
      return [
        {
          label: 'Cultivation, assigned',
          value: `+${(TRAINING_HALL_RATE_PER_LEVEL * level).toFixed(1)} pts/s each`,
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
  const rateMultiplier = (isOverLevel ? 0.5 : 1) * (qiPenaltyActive ? 0.5 : 1)
  const currentRate = def.produces ? def.baseRatePerLevel! * building.level * rateMultiplier : 0
  const nextRate = def.produces ? def.baseRatePerLevel! * (building.level + 1) : 0

  const assignedDisciples = state.disciples.filter((d) => d.assignedBuildingId === buildingId)
  const slotCount = getBuildingSlotCount(building.level)
  const emptySlots = Math.max(0, slotCount - assignedDisciples.length)
  const canAssign = buildingId !== SECT_HALL_ID
  const costEntries = Object.entries(eligibility.cost) as [keyof Resources, number][]
  const effectRows = getBuildingEffectRows(buildingId, building.level, state)

  return (
    <div className={`building-detail ${isOverLevel ? 'over-level' : ''}`}>
      <div className="building-detail-header">
        <h3>{def.name}</h3>
        <span className="building-category">{def.category}</span>
      </div>
      <p className="panel-hint">{def.description}</p>

      <p className="building-detail-section-title">Current effects</p>
      <dl className="building-detail-list">
        <div className="building-detail-row">
          <dt>Level</dt>
          <dd>{building.level}</dd>
        </div>
        {effectRows.map((row) => (
          <div className="building-detail-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        {def.produces && (
          <div className="building-detail-row">
            <dt>Production</dt>
            <dd>
              +{currentRate.toFixed(2)} {RESOURCE_LABELS[def.produces]}/s
            </dd>
          </div>
        )}
        {def.produces && (
          <div className="building-detail-row">
            <dt>At Lv{building.level + 1}</dt>
            <dd>
              +{nextRate.toFixed(2)} {RESOURCE_LABELS[def.produces]}/s
            </dd>
          </div>
        )}
      </dl>

      {isOverLevel && (
        <p className="over-level-badge">Over-Level Penalty active: -50% output (above Sect Hall level)</p>
      )}
      {qiPenaltyActive && (
        <p className="over-level-badge">
          Qi Stone output halved &mdash; reserve is feeding an Active Cultivation Boost
        </p>
      )}

      <p className="building-detail-section-title">Upgrade requirements</p>
      <ul className="building-requirements">
        {costEntries.map(([key, amount]) => (
          <li key={key}>
            <span>{RESOURCE_LABELS[key]}</span>
            <span>{amount}</span>
          </li>
        ))}
        <li>
          <span>Construction time</span>
          <span>{formatDurationAdaptive(eligibility.durationMs / 1000)}</span>
        </li>
      </ul>

      {canAssign && (
        <div className="building-assignment">
          <p className="building-detail-section-title">
            Work slots ({assignedDisciples.length} / {slotCount})
            {buildingId === 'trainingHall' ? ' — cultivate faster here' : ''}
          </p>
          <div className="work-slot-grid">
            {assignedDisciples.map((d) => (
              <div key={d.id} className="building-tile work-slot-tile filled">
                <span className="building-tile-name">{d.name}</span>
                <button onClick={() => assignDisciple(d.id, undefined)}>Unassign</button>
              </div>
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <button
                key={`empty-${i}`}
                type="button"
                className="building-tile building-tile-empty work-slot-tile"
                onClick={() => setAssignPickerOpen(true)}
              >
                <span className="building-tile-name">+ Assign disciple</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {assignPickerOpen && (
        <AssignDiscipleModal buildingId={buildingId} onClose={() => setAssignPickerOpen(false)} />
      )}

      {isConstructing ? (
        <div className="construction-status">
          <div className="progress-bar">
            <div
              className="progress-bar-fill day"
              style={{
                width: `${Math.min(
                  100,
                  100 - ((building.constructionEndsAt! - Date.now()) / (eligibility.durationMs || 1)) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="panel-hint">
            Upgrading to Lv{building.level + 1} &middot; {formatCountdown(building.constructionEndsAt! - Date.now())}{' '}
            remaining
          </p>
        </div>
      ) : (
        <div className="upgrade-controls">
          <button disabled={!eligibility.canUpgrade} onClick={() => startUpgrade(buildingId)}>
            Upgrade to Lv{eligibility.targetLevel}
          </button>
          {!eligibility.canUpgrade && eligibility.reason && (
            <p className="upgrade-blocked-reason">{eligibility.reason}</p>
          )}
        </div>
      )}

      {def.slotType === 'specialization' && !isConstructing && (
        <button
          type="button"
          className="demolish-button"
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
