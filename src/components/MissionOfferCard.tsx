import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getDisciplePowerRating, getMissionDispatchEligibility, getMissionSuccessChance } from '../game/engine/missions'
import { getDiscipleCombatPower, getSquadCombatPower } from '../game/engine/combatPower'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import type { DiscipleInstance, MissionBoardOffer, Resources } from '../game/types'
import type { MissionDefinition } from '../game/data/missionDefs'
import { DiscipleSelectList } from './DiscipleSelectList'

function formatReward(reward: Partial<Resources>): string {
  return (Object.entries(reward) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}

export function MissionOfferCard({ offer, def }: { offer: MissionBoardOffer; def: MissionDefinition }) {
  // Subscribing to the whole state so an in-progress squad selection reacts if a picked disciple leaves availability.
  const state = useGameStore((s) => s.state)
  const dispatchMission = useGameStore((s) => s.dispatchMission)
  const [squadIds, setSquadIds] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const combatPowerMult = getDoctrineModifiers(state).combatPowerMult
  // Rank by fit for THIS mission so the best pick is on the first page: combat power for
  // Hunting missions, the non-combat power rating (talent + realm) for the rest — the
  // same metrics that actually drive success. Idle/busy tiering still comes first.
  const missionScore = def.isCombat
    ? (d: DiscipleInstance) => getDiscipleCombatPower(d, combatPowerMult)
    : (d: DiscipleInstance) => getDisciplePowerRating(d)
  // Show that same fitness metric on each row: combat power for Hunting, the
  // non-combat fit rating for the rest, so the ordering reads at a glance.
  const formatMissionMetric = (d: DiscipleInstance) =>
    def.isCombat ? `${getDiscipleCombatPower(d, combatPowerMult)} CP` : `${Math.round(getDisciplePowerRating(d))} fit`
  const rosterForPicker = [...state.disciples].sort(compareDisciplesForSelection(state, combatPowerMult, missionScore))
  const squad = state.disciples.filter((d) => squadIds.includes(d.id))
  const eligibility = getMissionDispatchEligibility(state, offer, squadIds)

  const toggleDisciple = (id: string) => {
    setSquadIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : prev.length < def.squadSizeMax ? [...prev, id] : prev,
    )
  }

  const handleDispatch = () => {
    dispatchMission(offer.id, squadIds)
    setSquadIds([])
    setPickerOpen(false)
  }

  // Pre-Combat Intelligence (doc 06 §10) / legible success-chance broad strokes (doc 04 §4) — computed live as the squad selection changes.
  let preview: string | null = null
  if (squad.length > 0) {
    if (def.isCombat) {
      const squadCombatPower = getSquadCombatPower(squad, combatPowerMult)
      const enemyCombatPower = def.enemyCombatPower ?? 0
      const ratio = squadCombatPower / enemyCombatPower
      const assessment = ratio >= 1.15 ? 'Favorable' : ratio >= 0.9 ? 'Even' : 'Unfavorable'
      preview = `Squad Combat Power ${squadCombatPower} vs. enemy ${enemyCombatPower} — ${assessment}`
    } else {
      const chance = getMissionSuccessChance(def, squad)
      preview = `Estimated success chance: ${Math.round(chance * 100)}%`
    }
  }

  return (
    <div className="mission-card">
      <div className="mission-card-header">
        <h3>{def.name}</h3>
        <span className={`mission-risk risk-${def.risk.toLowerCase()}`}>{def.risk} Risk</span>
      </div>
      <p className="panel-hint">{def.description}</p>
      <p className="mission-meta">
        {def.type} &middot; {formatDurationAdaptive(def.durationMs / 1000)} &middot; Squad {def.squadSizeMin}
        {def.squadSizeMin !== def.squadSizeMax ? `-${def.squadSizeMax}` : ''}
        {def.isCombat && ` · Enemy CP ${def.enemyCombatPower}`}
      </p>
      <p className="mission-reward">Reward: {formatReward(def.rewardTable)}</p>

      <button onClick={() => setPickerOpen(true)}>
        Select Squad ({squadIds.length}/{def.squadSizeMax})
      </button>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{def.name} — Squad</h2>
            <p className="panel-hint">
              Choose {def.squadSizeMin}
              {def.squadSizeMin !== def.squadSizeMax ? `-${def.squadSizeMax}` : ''} disciple
              {def.squadSizeMax > 1 ? 's' : ''}.
            </p>

            <DiscipleSelectList
              disciples={rosterForPicker}
              selectedIds={squadIds}
              isSelectable={(id) => getDiscipleAvailability(state, id).available && squadIds.length < def.squadSizeMax}
              combatPowerMult={combatPowerMult}
              formatMetric={formatMissionMetric}
              onToggle={toggleDisciple}
            />

            {preview && <p className="mission-preview">{preview}</p>}

            <div className="dispatch-actions">
              <button disabled={!eligibility.canDispatch} onClick={handleDispatch}>
                Dispatch Squad
              </button>
              <button onClick={() => setPickerOpen(false)}>Cancel</button>
            </div>
            {!eligibility.canDispatch && eligibility.reason && (
              <p className="upgrade-blocked-reason">{eligibility.reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
