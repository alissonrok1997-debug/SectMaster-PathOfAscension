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

  /*
   * Pre-Combat Intelligence (doc 06 §10) / legible success-chance broad strokes (doc 04 §4),
   * computed live as the selection changes.
   *
   * Step 13 split what used to be one run-on `.mission-preview` sentence rendered *below*
   * the roster — i.e. below the fold, in info-blue used nowhere else for this job — into
   * the shared muster vocabulary in the sheet footer: the band as a tier-coloured verdict,
   * the two powers as opposed figures, the cost as its own sentence above the button.
   */
  const squadCombatPower = getSquadCombatPower(squad, combatPowerMult)
  const enemyCombatPower = def.enemyCombatPower ?? 0
  const band = squad.length > 0 && def.isCombat ? getAdvantageBand(squadCombatPower, enemyCombatPower) : undefined
  const successChance = squad.length > 0 && !def.isCombat ? getMissionSuccessChance(def, squad) : undefined

  const criticalNames = squad.filter((d) => getInjurySeverity(d) === 'critical').map((d) => d.name)
  const consequence = (() => {
    if (criticalNames.length > 0) {
      return {
        grave: true,
        text: `${criticalNames.join(', ')} ${criticalNames.length > 1 ? 'are' : 'is'} critically wounded. If this goes badly, they will not come back.`,
      }
    }
    if (def.isCombat && squad.length > 0) return { grave: false, text: 'If it goes badly: wounds, and a wounded disciple can die.' }
    // Verified against missions.ts:136 — a failed non-combat mission rolls squad injuries.
    if (successChance !== undefined)
      return { grave: false, text: `${Math.round(successChance * 100)}% chance of success — failure wounds the squad.` }
    return undefined
  })()

  const partyLine = squad.length === 0 ? 'No one committed yet' : squad.map((d) => d.name).join(' · ')

  return (
    // Risk rides the card's left stripe, so it spans the whole card rather than stopping
    // at the collapsed fold — it's a property of the mission, not of its summary.
    <div className={`mission-card risk-${def.risk.toLowerCase()} ${expanded ? 'expanded' : ''}`}>
      {/* Collapsed summary — name, duration and one reward line is enough to triage an offer. */}
      <button type="button" className="mission-card-header" aria-expanded={expanded} onClick={onToggle}>
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
          {/* The mission's only authored prose — §16.4's "text is the art". It was in hint
              grey; it is the one piece of flavour the trio has and it reads as the brief. */}
          <p className="muster-ground">{def.description}</p>
          <p className="mission-meta">
            <span className={`mission-risk risk-${def.risk.toLowerCase()}`}>{def.risk} Risk</span> &middot; {def.type}{' '}
            &middot; Squad {def.squadSizeMin}
            {def.squadSizeMin !== def.squadSizeMax ? `-${def.squadSizeMax}` : ''}
            {def.isCombat && (
              <>
                {' '}
                &middot; <span className="muster-power-other">Enemy {enemyCombatPower.toLocaleString()}</span>
              </>
            )}
          </p>

          {/* §7: this opens a picker, so it's secondary — the bare rule. It was `.quiet`,
              the lowest tier, which made the card's only action look unpressable. */}
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
              <div className="muster-commit">
                <p className={`muster-party ${squad.length === 0 ? 'empty' : ''}`}>{partyLine}</p>
                {band && (
                  <>
                    <p className={`muster-verdict tier-${band.tier}`}>{band.label}</p>
                    <div className="muster-powers">
                      <span className="muster-power-own">Your squad {squadCombatPower.toLocaleString()}</span>
                      <span className="muster-power-other">{def.enemyName ?? 'Enemy'} {enemyCombatPower.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar opposed" aria-hidden="true">
                      <div
                        className="progress-bar-fill own"
                        style={{ width: `${(squadCombatPower / Math.max(1, squadCombatPower + enemyCombatPower)) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                {consequence && (
                  <p className={`muster-consequence ${consequence.grave ? 'grave' : ''}`}>{consequence.text}</p>
                )}
              </div>
              {/* §7: this IS the commitment, so it's primary. It was a bare secondary. */}
              <button
                className="mission-dispatch-button primary"
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
        </BottomSheet>
      )}
    </div>
  )
}
