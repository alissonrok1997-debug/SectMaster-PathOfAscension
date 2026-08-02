import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getLocationDefFromState } from '../game/engine/world/worldQueries'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { getGarrisonEligibility } from '../game/engine/world/territory'
import { DiscipleSelectList } from './DiscipleSelectList'

/**
 * Station/recall disciples on a player-held outpost (FIRST_REALM_PLAN §4.1/§7).
 * An outpost's garrison is undefended unless disciples are explicitly assigned
 * here — unlike the sect seat, which defends itself automatically from the home
 * roster and is never garrisoned manually (territory.ts's getGarrisonEligibility
 * rejects it). Confirming replaces the whole roster stationed here.
 */
export function GarrisonPanel({ locationId, onClose }: { locationId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state)
  const garrisonSite = useGameStore((s) => s.garrisonSite)
  const ungarrisonSite = useGameStore((s) => s.ungarrisonSite)

  const currentGarrisonIds = state.world?.locations[locationId]?.garrison?.discipleIds ?? []
  const [selectedIds, setSelectedIds] = useState<string[]>(currentGarrisonIds)

  const locationDef = getLocationDefFromState(state, locationId)
  const combatPowerMult = getDoctrineModifiers(state).combatPowerMult
  // Whole roster, free (or already stationed here) first then strongest; disciples
  // busy elsewhere show disabled so it's clear who's committed and where.
  const candidates = [...state.disciples].sort(compareDisciplesForSelection(state, combatPowerMult))
  const isSelectable = (id: string) => currentGarrisonIds.includes(id) || getDiscipleAvailability(state, id).available

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const eligibility = getGarrisonEligibility(state, locationId, selectedIds)

  const confirm = () => {
    if (selectedIds.length === 0) {
      ungarrisonSite(locationId)
    } else {
      garrisonSite(locationId, selectedIds)
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Garrison — {locationDef?.name ?? 'Outpost'}</h2>
        <p className="panel-hint">
          Stationed disciples defend this outpost automatically but cannot be dispatched elsewhere until recalled.
        </p>

        <DiscipleSelectList
          disciples={candidates}
          selectedIds={selectedIds}
          isSelectable={isSelectable}
          combatPowerMult={combatPowerMult}
          onToggle={toggle}
        />

        {selectedIds.length > 0 && !eligibility.canGarrison && eligibility.reason && (
          <p className="upgrade-blocked-reason">{eligibility.reason}</p>
        )}

        <div className="dispatch-actions">
          <button disabled={selectedIds.length > 0 && !eligibility.canGarrison} onClick={confirm}>
            {selectedIds.length === 0 ? 'Recall Garrison' : 'Update Garrison'}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
