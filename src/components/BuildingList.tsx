import { useLayoutEffect, useState } from 'react'
import { getCoreBuildingDefs, SPECIALIZATION_SLOT_COUNT } from '../game/data/buildingDefs'
import { getClaimedSpecializationCount } from '../game/engine/specializationSlots'
import { useGameStore } from '../game/state/store'
import { BuildingTile } from './BuildingTile'
import { EmptySlotTile } from './EmptySlotTile'
import { BuildingDetailPanel } from './BuildingDetailPanel'
import { SpecializationSlotPicker } from './SpecializationSlotPicker'
import { BottomSheet } from './BottomSheet'

const CLAIM_SLOT_PREFIX = '__claim-'

export function BuildingList() {
  const state = useGameStore((s) => s.state)
  const claimedSpecializationIds = Object.keys(state.buildings).filter(
    (id) => !getCoreBuildingDefs().some((def) => def.id === id),
  )
  const claimedCount = getClaimedSpecializationCount(state)
  const emptySlotIds = Array.from(
    { length: Math.max(0, SPECIALIZATION_SLOT_COUNT - claimedCount) },
    (_, i) => `${CLAIM_SLOT_PREFIX}${i}`,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id))

  // If the selected building gets demolished while its sheet is open, close the sheet
  // instead of leaving it over now-empty content.
  useLayoutEffect(() => {
    if (selectedId && !selectedId.startsWith(CLAIM_SLOT_PREFIX) && !state.buildings[selectedId]) {
      setSelectedId(null)
    }
  }, [selectedId, state.buildings])

  const isClaimSlot = (id: string) => id.startsWith(CLAIM_SLOT_PREFIX)
  const closeSheet = () => setSelectedId(null)

  return (
    <section className="panel building-list-panel">
      <h2>Sect Buildings</h2>
      <p className="panel-hint">
        Single construction queue — only one upgrade can run at a time across the whole sect.
      </p>

      <p className="building-detail-section-title">Core Buildings</p>
      <div className="building-tile-grid">
        {getCoreBuildingDefs().map((def) => (
          <BuildingTile key={def.id} buildingId={def.id} active={selectedId === def.id} onSelect={toggle} />
        ))}
      </div>

      <p className="building-detail-section-title">
        Specializations ({claimedCount}/{SPECIALIZATION_SLOT_COUNT})
      </p>
      <div className="building-tile-grid">
        {claimedSpecializationIds.map((id) => (
          <BuildingTile key={id} buildingId={id} active={selectedId === id} onSelect={toggle} />
        ))}
        {emptySlotIds.map((slotId) => (
          <EmptySlotTile key={slotId} slotId={slotId} active={selectedId === slotId} onSelect={toggle} />
        ))}
      </div>

      <BottomSheet open={selectedId !== null} onClose={closeSheet} height="full">
        {selectedId && isClaimSlot(selectedId) && <SpecializationSlotPicker onClaimed={closeSheet} />}
        {selectedId && !isClaimSlot(selectedId) && state.buildings[selectedId] && (
          <BuildingDetailPanel buildingId={selectedId} />
        )}
      </BottomSheet>
    </section>
  )
}
