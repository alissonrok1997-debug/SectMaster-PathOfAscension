import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { computeDiscipleCapacity } from '../game/engine/discipleCapacity'
import { getBreakthroughAllSummary } from '../game/engine/cultivation'
import { getEffectiveRecruitmentCost } from '../game/engine/recruitment'
import { getSectUpkeepPerCycle, isUpkeepAffordable } from '../game/engine/upkeep'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { DiscipleCard } from './DiscipleCard'
import { DiscipleDetailModal } from './DiscipleDetailModal'

export function DiscipleRoster() {
  const state = useGameStore((s) => s.state)
  const recruitDisciple = useGameStore((s) => s.recruitDisciple)
  const attemptBreakthroughAll = useGameStore((s) => s.attemptBreakthroughAll)
  const [openDiscipleId, setOpenDiscipleId] = useState<string | null>(null)

  const capacity = computeDiscipleCapacity(state.buildings)
  const cost = getEffectiveRecruitmentCost(state)
  const atCapacity = state.disciples.length >= capacity
  const canAfford = state.resources.spiritStones >= cost
  const upkeep = getSectUpkeepPerCycle(state)
  const upkeepAffordable = isUpkeepAffordable(state)
  const nextUpkeepIn = formatDurationAdaptive(Math.max(0, state.nextUpkeepAt - Date.now()) / 1000)
  const breakthroughAll = getBreakthroughAllSummary(state)

  return (
    <section className="panel disciple-roster-panel">
      <div className="disciple-roster-header">
        <h2>Disciples</h2>
        <div className="disciple-roster-actions">
          {breakthroughAll.readyCount > 0 && (
            <button disabled={!breakthroughAll.canAffordAll} onClick={attemptBreakthroughAll}>
              Break through all ({breakthroughAll.readyCount} ready · {breakthroughAll.totalCost} Qi Stone)
            </button>
          )}
          <button disabled={atCapacity || !canAfford} onClick={recruitDisciple}>
            Recruit Disciple ({cost} Spirit Stones)
          </button>
        </div>
      </div>
      {breakthroughAll.readyCount > 0 && !breakthroughAll.canAffordAll && (
        <p className="panel-hint">
          Need {breakthroughAll.totalCost} Qi Stone to break through all {breakthroughAll.readyCount} ready disciple
          {breakthroughAll.readyCount > 1 ? 's' : ''}.
        </p>
      )}
      <p className="panel-hint">
        {state.disciples.length} / {capacity} disciples &middot; capacity set by Dormitory level
        {atCapacity && ' — at capacity, upgrade the Dormitory for more'}
      </p>
      {state.disciples.length > 0 && (
        <p className="panel-hint">
          Upkeep: {Math.round(upkeep.spiritStones)} Spirit Stone &middot; {Math.round(upkeep.qiStone)} Qi Stone per hour
          &middot; next in {nextUpkeepIn}
        </p>
      )}
      {!upkeepAffordable && state.disciples.length > 0 && (
        <p className="over-level-badge">⚠ Can't afford the next upkeep — morale will drop.</p>
      )}

      {state.disciples.length === 0 ? (
        <p className="panel-hint">No disciples yet. Recruit one to start filling the sect.</p>
      ) : (
        <div className="disciple-grid">
          {[...state.disciples]
            .sort((a, b) => b.talent - a.talent)
            .map((d) => (
              <DiscipleCard key={d.id} discipleId={d.id} onSelect={setOpenDiscipleId} />
            ))}
        </div>
      )}

      {openDiscipleId && (
        <DiscipleDetailModal initialDiscipleId={openDiscipleId} onClose={() => setOpenDiscipleId(null)} />
      )}
    </section>
  )
}
