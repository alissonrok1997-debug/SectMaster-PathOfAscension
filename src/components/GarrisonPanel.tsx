import { BottomSheet } from './BottomSheet'
import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getLocation, getLocationDefFromState } from '../game/engine/world/worldQueries'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { getInjurySeverity } from '../game/engine/injury'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { getSquadCombatPower } from '../game/engine/combatPower'
import { getWorldModifiers } from '../game/engine/world/worldModifiers'
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
  const setGarrisonReturnWhenWounded = useGameStore((s) => s.setGarrisonReturnWhenWounded)

  const currentGarrison = state.world?.locations[locationId]?.garrison
  const currentGarrisonIds = currentGarrison?.discipleIds ?? []
  const [selectedIds, setSelectedIds] = useState<string[]>(currentGarrisonIds)
  const [returnWhenWounded, setReturnWhenWounded] = useState<boolean>(currentGarrison?.returnWhenWounded ?? false)

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

  /*
   * §16.4 applied to the one surface where the player is the *defender*. Garrison gets no
   * advantage band, deliberately: the raider is unknown at stationing time, so a verdict
   * would be inventing an enemy. Dispatch is a wager; garrison is a posture.
   *
   * Mirrors getOutpostDefensePower (territory.ts:57) against the pending selection rather
   * than the stored garrison, so the number moves as the player picks.
   */
  const garrisonParty = state.disciples.filter((d) => selectedIds.includes(d.id))
  const defencePower = Math.round(getSquadCombatPower(garrisonParty, combatPowerMult) * getWorldModifiers(state).defenceMult)
  const location = getLocation(state, locationId)
  const dangerTier = location?.dangerTier ?? 0
  const threatClass = dangerTier <= 1 ? 'threat-low' : dangerTier === 2 ? 'threat-mid' : 'threat-high'

  const criticalNames = garrisonParty.filter((d) => getInjurySeverity(d) === 'critical').map((d) => d.name)
  const consequence =
    criticalNames.length > 0
      ? {
          grave: true,
          text: `${criticalNames.join(', ')} ${criticalNames.length > 1 ? 'are' : 'is'} critically wounded and could die if this outpost is raided.`,
        }
      : selectedIds.length > 0
        ? { grave: false, text: 'Stationed disciples cannot be dispatched elsewhere until recalled.' }
        : undefined

  const partyLine = garrisonParty.length === 0 ? 'No one stationed' : garrisonParty.map((d) => d.name).join(' · ')

  const confirm = () => {
    if (selectedIds.length === 0) {
      ungarrisonSite(locationId)
    } else {
      // Stationing a critical-band disciple exposes them to death in a raid (Phase 5) — confirm explicitly.
      const critical = state.disciples.filter((d) => selectedIds.includes(d.id) && getInjurySeverity(d) === 'critical')
      if (critical.length > 0) {
        const names = critical.map((d) => d.name).join(', ')
        if (!window.confirm(`${names} ${critical.length > 1 ? 'are' : 'is'} critically wounded — stationing them here risks death if the outpost is raided. Garrison anyway?`)) return
      }
      garrisonSite(locationId, selectedIds)
      setGarrisonReturnWhenWounded(locationId, returnWhenWounded)
    }
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Garrison — ${locationDef?.name ?? 'Outpost'}`}
      height="full"
      footer={
        <>
          <div className="muster-commit">
            <p className={`muster-party ${garrisonParty.length === 0 ? 'empty' : ''}`}>{partyLine}</p>
            <div className="muster-powers">
              <span className="muster-power-own">Defence {defencePower.toLocaleString()}</span>
            </div>
            {consequence && (
              <p className={`muster-consequence ${consequence.grave ? 'grave' : ''}`}>{consequence.text}</p>
            )}
          </div>
          <button
            className="dispatch-confirm-button primary"
            disabled={selectedIds.length > 0 && !eligibility.canGarrison}
            onClick={confirm}
          >
            {selectedIds.length === 0 ? 'Recall Garrison' : 'Update Garrison'}
          </button>
          {selectedIds.length > 0 && !eligibility.canGarrison && eligibility.reason && (
            <p className="upgrade-blocked-reason">{eligibility.reason}</p>
          )}
        </>
      }
    >
        <div className={`muster-brief ${threatClass}`}>
          <p className="muster-ground">Stationed disciples defend this outpost automatically, without being dispatched.</p>
          <p className="muster-facts">Danger {dangerTier} &middot; undefended until someone is stationed here</p>
        </div>

        <DiscipleSelectList
          disciples={candidates}
          selectedIds={selectedIds}
          isSelectable={isSelectable}
          combatPowerMult={combatPowerMult}
          onToggle={toggle}
        />

        {selectedIds.length > 0 && (
          <label className="garrison-recall-toggle">
            <input type="checkbox" checked={returnWhenWounded} onChange={(e) => setReturnWhenWounded(e.target.checked)} />
            Auto-recall a disciple to the sect when wounded (frees the slot; shrinks their death risk)
          </label>
        )}

    </BottomSheet>
  )
}
