import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { DiscipleSelectList } from './DiscipleSelectList'
import { BottomSheet } from './BottomSheet'

/** Picks which disciple takes an empty work slot. Opens stacked above the building sheet. */
export function AssignDiscipleModal({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state)
  const assignDisciple = useGameStore((s) => s.assignDisciple)
  const def = getBuildingDef(buildingId)

  const combatPowerMult = getDoctrineModifiers(state).combatPowerMult
  // Free disciples first, then strongest; disciples busy away (mission/expedition/
  // garrison) still show, disabled, so their occupation is visible.
  const candidates = state.disciples
    .filter((d) => d.assignedBuildingId !== buildingId)
    .sort(compareDisciplesForSelection(state, combatPowerMult))

  return (
    <BottomSheet open onClose={onClose} title={`Assign to ${def.name}`} height="full">
      <p className="panel-hint">Choose a disciple to take this work slot.</p>
      <DiscipleSelectList
        disciples={candidates}
        selectedIds={[]}
        isSelectable={(id) => getDiscipleAvailability(state, id).available}
        combatPowerMult={combatPowerMult}
        emptyMessage="No available disciples — all are assigned here or away."
        onToggle={(id) => {
          assignDisciple(id, buildingId)
          onClose()
        }}
      />
    </BottomSheet>
  )
}
