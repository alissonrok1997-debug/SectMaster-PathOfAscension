import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getMissionDispatchEligibility, getMissionSuccessChance } from '../game/engine/missions'
import { getSquadCombatPower } from '../game/engine/combatPower'
import { getDoctrineModifiers } from '../game/engine/doctrine'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import type { MissionBoardOffer, Resources } from '../game/types'
import type { MissionDefinition } from '../game/data/missionDefs'

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

  const availableDisciples = state.disciples.filter((d) => d.awayUntil === undefined)
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
  }

  // Pre-Combat Intelligence (doc 06 §10) / legible success-chance broad strokes (doc 04 §4) — computed live as the squad selection changes.
  let preview: string | null = null
  if (squad.length > 0) {
    if (def.isCombat) {
      const squadCombatPower = getSquadCombatPower(squad, getDoctrineModifiers(state).combatPowerMult)
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

      <div className="mission-squad-picker">
        {availableDisciples.length === 0 ? (
          <p className="panel-hint">No disciples available to send.</p>
        ) : (
          availableDisciples.map((d) => (
            <label key={d.id} className="mission-squad-option">
              <input
                type="checkbox"
                checked={squadIds.includes(d.id)}
                disabled={!squadIds.includes(d.id) && squadIds.length >= def.squadSizeMax}
                onChange={() => toggleDisciple(d.id)}
              />
              {d.name} ({d.role}, {d.realm}
              {d.injury !== 'none' ? `, ${d.injury}` : ''})
            </label>
          ))
        )}
      </div>

      {preview && <p className="mission-preview">{preview}</p>}

      <button disabled={!eligibility.canDispatch} onClick={handleDispatch}>
        Dispatch Squad
      </button>
      {!eligibility.canDispatch && eligibility.reason && <p className="upgrade-blocked-reason">{eligibility.reason}</p>}
    </div>
  )
}
