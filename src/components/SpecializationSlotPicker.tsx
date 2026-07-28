import { useGameStore } from '../game/state/store'
import { getAvailableSpecializationDefs, getClaimSlotEligibility } from '../game/engine/specializationSlots'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import type { Resources } from '../game/types'

/** Drawer content shown when an empty specialization slot is clicked — pick which building to claim into it. */
export function SpecializationSlotPicker({ onClaimed }: { onClaimed: () => void }) {
  const state = useGameStore((s) => s.state)
  const claimSpecializationSlot = useGameStore((s) => s.claimSpecializationSlot)
  const available = getAvailableSpecializationDefs(state)

  return (
    <div className="building-detail">
      <div className="building-detail-header">
        <h3>Choose a Specialization</h3>
      </div>
      <p className="panel-hint">Pick a building to construct into this slot.</p>

      <ul className="specialization-picker-list">
        {available.map((def) => {
          const eligibility = getClaimSlotEligibility(state, def.id)
          const costEntries = Object.entries(eligibility.cost) as [keyof Resources, number][]
          return (
            <li key={def.id} className="specialization-picker-item">
              <div className="specialization-picker-info">
                <span className="specialization-picker-name">{def.name}</span>
                <span className="building-category">{def.category}</span>
                <p className="panel-hint">{def.description}</p>
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
              </div>
              <button
                disabled={!eligibility.canClaim}
                onClick={() => {
                  claimSpecializationSlot(def.id)
                  onClaimed()
                }}
              >
                Claim
              </button>
              {!eligibility.canClaim && eligibility.reason && (
                <p className="upgrade-blocked-reason">{eligibility.reason}</p>
              )}
            </li>
          )
        })}
        {available.length === 0 && <p className="panel-hint">No specialization buildings left to claim.</p>}
      </ul>
    </div>
  )
}
