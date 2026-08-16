import { useGameStore } from '../game/state/store'
import { getBuildingDef, SECT_HALL_ID } from '../game/data/buildingDefs'
import {
  getAssignEligibility,
  getAssignedDiscipleCount,
  getBuildingSlotCount,
} from '../game/engine/buildingAssignment'
import { BottomSheet } from './BottomSheet'
import { UiIcon } from './UiIcon'

/**
 * Replaces the native `<select>` on the disciple leaf — on a hand-inked parchment sheet the
 * single most jarring control on the screen. It was the last one on Disciples; two remain in
 * `ProvinceDetailView` on the World screen, which is un-migrated and out of scope here.
 *
 * Same shape as `EquipmentSlotPicker`, deliberately: one picker vocabulary, one set of
 * `.slot-option` rules, one stacked-sheet behaviour. It also says more than a dropdown could.
 * An `<option>` can only carry a name, so the old control appended "(slots full)" and stopped
 * there; a row can carry the occupancy of every building — `2 / 3 slots` — which is the number
 * the player is actually choosing on, and the blocking reason inline beneath the name (§14:
 * inline disclosure, never a tooltip).
 */
export function AssignBuildingPicker({
  discipleId,
  onClose,
}: {
  discipleId: string
  onClose: () => void
}) {
  const state = useGameStore((s) => s.state)
  const assignDisciple = useGameStore((s) => s.assignDisciple)

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return null

  // Same derivation the panel's <select> used: every built building except the Sect Hall,
  // which offers no work slots.
  const buildings = Object.keys(state.buildings)
    .filter((id) => id !== SECT_HALL_ID)
    .map((id) => getBuildingDef(id))

  const choose = (buildingId: string | undefined) => {
    assignDisciple(discipleId, buildingId)
    onClose()
  }

  return (
    <BottomSheet open onClose={onClose} title="Posting" height="full" panelClassName="parchment leaf">
      <button
        type="button"
        className={`slot-option${disciple.assignedBuildingId === undefined ? ' current' : ''}`}
        onClick={() => choose(undefined)}
      >
        <span className="slot-option-main">
          <span className="slot-option-name">Idle / Rest</span>
          <span className="slot-option-affixes">No work assignment. Cultivation continues.</span>
        </span>
        {disciple.assignedBuildingId === undefined && <UiIcon name="check" size={16} />}
      </button>

      {buildings.map((def) => {
        const eligibility = getAssignEligibility(state, discipleId, def.id)
        const slots = getBuildingSlotCount(state.buildings[def.id].level)
        const taken = getAssignedDiscipleCount(state, def.id)
        const current = disciple.assignedBuildingId === def.id

        return (
          <button
            key={def.id}
            type="button"
            className={`slot-option${current ? ' current' : ''}`}
            disabled={!eligibility.canAssign}
            onClick={() => choose(def.id)}
          >
            <span className="slot-option-main">
              <span className="slot-option-name">{def.name}</span>
              {!eligibility.canAssign && eligibility.reason && (
                <span className="slot-option-affixes">{eligibility.reason}</span>
              )}
            </span>
            {current ? (
              <UiIcon name="check" size={16} />
            ) : (
              <span className="slot-option-delta">
                {taken} / {slots} slots
              </span>
            )}
          </button>
        )
      })}
    </BottomSheet>
  )
}
