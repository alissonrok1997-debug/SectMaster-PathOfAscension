import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { DiscipleSelectList } from './DiscipleSelectList'
import { BottomSheet } from './BottomSheet'

/**
 * Picks which disciple takes an empty work slot. Opens stacked above the building sheet.
 *
 * On paper since 2026-08-16. The building sheet beneath it is `parchment leaf`, and this was
 * the last dark surface reachable from Buildings: you tapped a paper work-slot row and a dark
 * sheet slid over it — the seam SCREEN_BUILDINGS calls the most visible one a half-migration
 * can have. `AssignBuildingPicker` — the mirror control, disciple → building — was already on
 * paper, so the two halves of one decision now match.
 *
 * The other three consumers of `DiscipleSelectList` (Missions, Dispatch, Garrison) stay dark,
 * because their screens are un-migrated: a paper picker over a dark screen is the same seam
 * pointing the other way.
 */
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
    <BottomSheet
      open
      onClose={onClose}
      title={`Assign to ${def.name}`}
      height="full"
      panelClassName="parchment leaf"
    >
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
