import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'

const PAGE_SIZE = 5

/** Reuses DecisionEventModal's overlay/panel pattern — picks which disciple takes an empty work slot. */
export function AssignDiscipleModal({ buildingId, onClose }: { buildingId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state)
  const assignDisciple = useGameStore((s) => s.assignDisciple)
  const def = getBuildingDef(buildingId)
  const [page, setPage] = useState(0)

  // Unassigned (idle) disciples first, then those reassignable from another building.
  const candidates = state.disciples
    .filter((d) => d.awayUntil === undefined && d.assignedBuildingId !== buildingId)
    .sort((a, b) => (a.assignedBuildingId ? 1 : 0) - (b.assignedBuildingId ? 1 : 0))

  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageItems = candidates.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Assign to {def.name}</h2>
        <p className="panel-hint">Choose a disciple to take this work slot.</p>
        {candidates.length > 0 ? (
          <>
            <div className="assign-disciple-choices">
              {pageItems.map((d) => (
                <button
                  className="assign-disciple-choice"
                  key={d.id}
                  onClick={() => {
                    assignDisciple(d.id, buildingId)
                    onClose()
                  }}
                >
                  <span className="assign-disciple-name">{d.name}</span>
                  <span className="assign-disciple-meta">
                    {d.realm} &middot; {d.role}
                    {d.assignedBuildingId ? ` · from ${getBuildingDef(d.assignedBuildingId).name}` : ' · idle'}
                  </span>
                </button>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="assign-disciple-pagination">
                <button disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
                  Prev
                </button>
                <span className="panel-hint">
                  Page {clampedPage + 1} of {pageCount} &middot; {candidates.length} available
                </span>
                <button disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="panel-hint">No available disciples — all are assigned here or away.</p>
        )}
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
