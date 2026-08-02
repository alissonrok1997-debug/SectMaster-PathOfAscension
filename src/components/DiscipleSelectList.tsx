import { useState } from 'react'
import type { DiscipleInstance } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { describeDiscipleActivity } from '../game/engine/discipleAvailability'

const DEFAULT_PAGE_SIZE = 5

/**
 * The one paginated disciple-selection list, shared by every place the player picks
 * disciples (Assignment, Missions, Dispatch party, Garrison). The parent pre-sorts the
 * candidates (compareDisciplesForSelection) and supplies the per-surface selectability
 * rule; this component only paginates and renders. A selected disciple is always
 * toggleable off (`!selected && !isSelectable`), so a pick can be undone even when the
 * disciple would otherwise be unpickable.
 */
export function DiscipleSelectList({
  disciples,
  selectedIds,
  onToggle,
  isSelectable,
  combatPowerMult,
  formatMetric,
  pageSize = DEFAULT_PAGE_SIZE,
  emptyMessage = 'No disciples in the sect yet.',
}: {
  disciples: DiscipleInstance[]
  selectedIds: string[]
  onToggle: (id: string) => void
  isSelectable: (id: string) => boolean
  combatPowerMult: number
  /** Overrides the per-row stat (default: combat power) — e.g. a mission's fit rating. */
  formatMetric?: (d: DiscipleInstance) => string
  pageSize?: number
  emptyMessage?: string
}) {
  const state = useGameStore((s) => s.state)
  const [page, setPage] = useState(0)

  if (disciples.length === 0) {
    return <p className="panel-hint">{emptyMessage}</p>
  }

  const pageCount = Math.max(1, Math.ceil(disciples.length / pageSize))
  const clampedPage = Math.min(page, pageCount - 1)
  const pageItems = disciples.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize)

  return (
    <>
      <div className="assign-disciple-choices">
        {pageItems.map((d) => {
          const selected = selectedIds.includes(d.id)
          return (
            <button
              key={d.id}
              className={`assign-disciple-choice ${selected ? 'selected' : ''}`}
              disabled={!selected && !isSelectable(d.id)}
              onClick={() => onToggle(d.id)}
            >
              <span className="assign-disciple-name">
                {selected ? '✓ ' : ''}
                {d.name}
              </span>
              <span className="assign-disciple-meta">
                {d.realm} &middot; {d.role} &middot;{' '}
                {formatMetric ? formatMetric(d) : `${getDiscipleCombatPower(d, combatPowerMult)} CP`} &middot;{' '}
                {describeDiscipleActivity(state, d.id)}
                {d.injury !== 'none' ? ` · ${d.injury} injury` : ''}
              </span>
            </button>
          )
        })}
      </div>
      {pageCount > 1 && (
        <div className="assign-disciple-pagination">
          <button disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}>
            Prev
          </button>
          <span className="panel-hint">
            Page {clampedPage + 1} of {pageCount} &middot; {disciples.length} disciples
          </span>
          <button disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  )
}
