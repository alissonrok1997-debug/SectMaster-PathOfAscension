import { useGameStore } from '../game/state/store'
import { computeDiscipleCapacity } from '../game/engine/discipleCapacity'
import { getRecruitmentCost } from '../game/engine/recruitment'
import { DiscipleCard } from './DiscipleCard'

export function DiscipleRoster() {
  const state = useGameStore((s) => s.state)
  const recruitDisciple = useGameStore((s) => s.recruitDisciple)

  const capacity = computeDiscipleCapacity(state.buildings)
  const cost = getRecruitmentCost(state.disciples.length)
  const atCapacity = state.disciples.length >= capacity
  const canAfford = state.resources.spiritStones >= cost

  return (
    <section className="panel disciple-roster-panel">
      <div className="disciple-roster-header">
        <h2>Disciples</h2>
        <button disabled={atCapacity || !canAfford} onClick={recruitDisciple}>
          Recruit Disciple ({cost} Spirit Stones)
        </button>
      </div>
      <p className="panel-hint">
        {state.disciples.length} / {capacity} disciples &middot; capacity set by Dormitory level
        {atCapacity && ' — at capacity, upgrade the Dormitory for more'}
      </p>

      {state.disciples.length === 0 ? (
        <p className="panel-hint">No disciples yet. Recruit one to start filling the sect.</p>
      ) : (
        <div className="disciple-grid">
          {state.disciples.map((d) => (
            <DiscipleCard key={d.id} discipleId={d.id} />
          ))}
        </div>
      )}
    </section>
  )
}
