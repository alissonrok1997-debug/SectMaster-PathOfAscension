import { BottomSheet } from './BottomSheet'

/** Gates the whole shell — it must be resolved, not dismissed. */
const NO_DISMISS = () => {}
import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getSectSiteDef } from '../game/data/world/sectSiteDefs'
import { getBuildingDef } from '../game/data/buildingDefs'

/**
 * Fires the instant a winning seat-claim relocates the sect but the new seat's
 * `buildingSlots` can't fit every current building (FIRST_REALM_PLAN §4.2/§7).
 * The relocation itself already happened — this only makes the player choose
 * which specialization buildings survive, mirroring FoundingScreen's app-gate
 * ("confirms the whole-sect migration"). Core buildings always move for free
 * and are never listed here.
 */
export function RelocationPruneModal() {
  const pending = useGameStore((s) => s.state.pendingRelocation)
  const buildings = useGameStore((s) => s.state.buildings)
  const resolveRelocationPrune = useGameStore((s) => s.resolveRelocationPrune)
  const [toRemove, setToRemove] = useState<string[]>([])

  if (!pending) return null

  const newSite = getSectSiteDef(pending.newSiteId)
  const specializationBuildings = Object.values(buildings).filter((b) => getBuildingDef(b.id).slotType === 'specialization')

  const toggle = (id: string) => {
    setToRemove((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const remainingCount = Object.keys(buildings).length - toRemove.length
  const canConfirm = remainingCount <= newSite.buildingSlots

  return (
    <BottomSheet
      open
      onClose={NO_DISMISS}
      title={`Settling Into ${newSite.name}`}
      height="full"
      dismissible={false}
      footer={
        <button className="sheet-primary-action primary" disabled={!canConfirm} onClick={() => resolveRelocationPrune(toRemove)}>
          Confirm Migration
        </button>
      }
    >
        <p className="panel-hint">
          {newSite.name} only has {newSite.buildingSlots} building slots — {pending.requiredRemovals} fewer than your
          sect currently uses. Choose which specialization buildings to leave behind (core buildings always move).
        </p>
        <p className="panel-hint">
          Selected for removal: {toRemove.length} / {pending.requiredRemovals} needed
        </p>

        <div className="assign-disciple-choices">
          {specializationBuildings.map((b) => {
            const def = getBuildingDef(b.id)
            const selected = toRemove.includes(b.id)
            return (
              <button
                key={b.id}
                className={`assign-disciple-choice ${selected ? 'selected' : ''}`}
                onClick={() => toggle(b.id)}
              >
                <span className="assign-disciple-name">
                  {selected ? '✓ ' : ''}
                  {def.name}
                </span>
                <span className="assign-disciple-meta">Level {b.level}</span>
              </button>
            )
          })}
        </div>

        {!canConfirm && (
          <p className="upgrade-blocked-reason">
            Select at least {remainingCount - newSite.buildingSlots} more building{remainingCount - newSite.buildingSlots > 1 ? 's' : ''} to remove.
          </p>
        )}

    </BottomSheet>
  )
}
