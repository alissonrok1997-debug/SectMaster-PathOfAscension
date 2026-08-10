import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getDisciplePowerRating, getMissionDispatchEligibility, getMissionSuccessChance } from '../game/engine/missions'
import { getDiscipleCombatPower, getSquadCombatPower } from '../game/engine/combatPower'
import { getAdvantageBand } from '../game/engine/combat/battleSimulator'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { compareDisciplesForSelection, getDiscipleAvailability } from '../game/engine/discipleAvailability'
import { getInjurySeverity } from '../game/engine/injury'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import type { DiscipleInstance, MissionBoardOffer, Resources } from '../game/types'
import type { MissionDefinition } from '../game/data/missionDefs'
import { DiscipleSelectList } from './DiscipleSelectList'
import { BottomSheet } from './BottomSheet'

function formatReward(reward: Partial<Resources>): string {
  return (Object.entries(reward) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}

export function MissionOfferCard({
  offer,
  def,
  expanded,
  onToggle,
}: {
  offer: MissionBoardOffer
  def: MissionDefinition
  expanded: boolean
  onToggle: () => void
}) {
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
    // Dispatching a critical-band disciple risks their death (Phase 5) — require explicit confirmation, not just the coloured label.
    const critical = squad.filter((d) => getInjurySeverity(d) === 'critical')
    if (critical.length > 0) {
      const names = critical.map((d) => d.name).join(', ')
      if (!window.confirm(`${names} ${critical.length > 1 ? 'are' : 'is'} critically wounded — sending ${critical.length > 1 ? 'them' : 'them'} out risks death. Dispatch anyway?`)) return
    }
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
      // Advantage band over the actual win curve (Phase 3, #11) — honest about the defender-favoured odds, unlike the old raw-ratio thresholds.
      const assessment = getAdvantageBand(squadCombatPower, enemyCombatPower).label
      preview = `Squad Combat Power ${squadCombatPower} vs. enemy ${enemyCombatPower} — ${assessment}`
    } else {
      const chance = getMissionSuccessChance(def, squad)
      preview = `Estimated success chance: ${Math.round(chance * 100)}%`
    }
  }

  return (
    <div className={`mission-card ${expanded ? 'expanded' : ''}`}>
      {/* Collapsed summary — name, duration and one reward line is enough to triage an offer. */}
      <button type="button" className="mission-card-header" aria-expanded={expanded} onClick={onToggle}>
        <span className={`mission-risk-bar risk-${def.risk.toLowerCase()}`} aria-hidden="true" />
        <span className="mission-card-summary">
          <span className="mission-card-title">
            <h3>{def.name}</h3>
            <span className="mission-card-duration">{formatDurationAdaptive(def.durationMs / 1000)}</span>
          </span>
          <span className="mission-reward">{formatReward(def.rewardTable)}</span>
        </span>
        <span className="mission-card-chevron" aria-hidden="true">
          {expanded ? '⌃' : '›'}
        </span>
      </button>

      {expanded && (
        <div className="mission-card-body">
          <p className="panel-hint">{def.description}</p>
          <p className="mission-meta">
            <span className={`mission-risk risk-${def.risk.toLowerCase()}`}>{def.risk} Risk</span> &middot; {def.type}{' '}
            &middot; Squad {def.squadSizeMin}
            {def.squadSizeMin !== def.squadSizeMax ? `-${def.squadSizeMax}` : ''}
            {def.isCombat && ` · Enemy CP ${def.enemyCombatPower}`}
          </p>

          <button className="mission-squad-button" onClick={() => setPickerOpen(true)}>
            Select Squad ({squadIds.length}/{def.squadSizeMax})
          </button>
        </div>
      )}

      {pickerOpen && (
        <BottomSheet
          open
          onClose={() => setPickerOpen(false)}
          title={`${def.name} — Squad`}
          height="full"
          footer={
            <>
              <button
                className="mission-dispatch-button"
                disabled={!eligibility.canDispatch}
                onClick={handleDispatch}
              >
                Dispatch Squad
              </button>
              {!eligibility.canDispatch && eligibility.reason && (
                <p className="upgrade-blocked-reason">{eligibility.reason}</p>
              )}
            </>
          }
        >
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
        </BottomSheet>
      )}
    </div>
  )
}
