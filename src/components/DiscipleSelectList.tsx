import { useState } from 'react'
import { UiIcon } from './UiIcon'
import type { DiscipleInstance } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getDiscipleCombatPower } from '../game/engine/combatPower'
import { getInjurySeverity } from '../game/engine/injury'
import { describeDiscipleActivity } from '../game/engine/discipleAvailability'
import { EMBER_ART } from '../assets/icons'
import { DisciplePortrait, RealmLine } from './DisciplePortrait'

const DEFAULT_PAGE_SIZE = 5

/**
 * The one paginated disciple-selection list, shared by every place the player picks
 * disciples (Assignment, Missions, Dispatch party, Garrison). The parent pre-sorts the
 * candidates (compareDisciplesForSelection) and supplies the per-surface selectability
 * rule; this component only paginates and renders. A selected disciple is always
 * toggleable off (`!selected && !isSelectable`), so a pick can be undone even when the
 * disciple would otherwise be unpickable.
 *
 * ── THE CARD, redesigned 2026-08-16 ─────────────────────────────────────────
 *
 * It was a name over one run-on grey line — `realm · role · CP · activity · injury`: five
 * facts at one weight, one size and one colour, so nothing was ranked and a list built for
 * comparing people had to be read rather than scanned. It is now §8's record anatomy at row
 * scale, the same `[art] [name + metadata] [value]` the design system already assigns to this
 * family:
 *
 *   [ portrait 48×61 ]  [ name .................. 🔥 CP ]
 *                       [ realm · 4th ]
 *                       [ foot line — only when there is something to say ]
 *
 * Two facts left rather than being restyled:
 *
 *   - **Role as text.** The portrait plaque carries the role glyph on its nameplate, which is
 *     the whole reason that nameplate exists (§16.2). Printing it again was the longest word
 *     on the line.
 *   - **`Idle` as a foot line.** The sort puts free disciples first, so the silent block at
 *     the top *is* the "these are available" signal — Buildings' rule that a row in its
 *     ordinary state says nothing, applied to the state a picker is actually hunting for.
 *     Working, away and injured all still speak, because those are the picks that cost
 *     something.
 *
 * The markup is ground-agnostic; only the Assignment sheet is on paper today
 * (`panelClassName="parchment leaf"`). Every class here either remaps through `.leaf` or has
 * an explicit paper rule beside the dark one in `App.css`.
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
          const severity = getInjurySeverity(d)
          const activity = describeDiscipleActivity(state, d.id)
          /* Injury rides the same line as the activity, so a working *and* hurt disciple costs
             one row rather than two. `critical` still gets its own warning below — that one is
             a consequence, not a status. */
          const foot = [activity === 'Idle' ? '' : activity, severity !== 'none' ? `${severity} injury` : '']
            .filter(Boolean)
            .join(' · ')

          return (
            <button
              key={d.id}
              className={`assign-disciple-choice ${selected ? 'selected' : ''} ${severity === 'critical' ? 'critical' : ''}`}
              disabled={!selected && !isSelectable(d.id)}
              onClick={() => onToggle(d.id)}
            >
              {/* The row lives one level in. `.assign-disciple-choice` itself stays the stacked
                  column that the expedition leader picker, the seat defence leader and the
                  relocation prune still render `[name][meta]` into. */}
              <span className="assign-disciple-body">
                {/* The base 48×61 plaque, not a new variant: `plate` and `grid` are styled only
                    inside `.parchment` for the roster's two shapes, and a row is neither. */}
                <DisciplePortrait disciple={d} />

                <span className="assign-disciple-text">
                  <span className="assign-disciple-line">
                    <span className="assign-disciple-name">
                      {/* §15: the tick is chrome, so it is the `check` glyph rather than a `✓`
                          character sitting inside the name. */}
                      {selected && <UiIcon name="check" size={14} />}
                      {d.name}
                    </span>
                    {/* The value slot. A `formatMetric` surface spells its own unit (`18 fit`,
                        `42 CP`), so the ember is added only to the default reading — it is the
                        game's mark for Combat Power, not decoration on any number. */}
                    {formatMetric ? (
                      <span className="assign-disciple-metric">{formatMetric(d)}</span>
                    ) : (
                      <span className="disciple-row-cp" aria-label="Combat Power">
                        <img className="cp-ember" src={EMBER_ART} alt="" aria-hidden="true" draggable={false} />
                        {getDiscipleCombatPower(d, combatPowerMult)}
                      </span>
                    )}
                  </span>

                  {/* The shared identity phrase, jade, display face — as on the plate and the
                      leaf. Spelled in full here: unlike the roster there is no realm rule above
                      the block to pay for the ordinal alone. */}
                  <RealmLine disciple={d} />

                  {foot && <span className="assign-disciple-foot">{foot}</span>}

                  {severity === 'critical' && (
                    <span className="assign-disciple-warning">
                      <UiIcon name="warning" size={14} /> Critical — risks death if dispatched
                    </span>
                  )}
                </span>
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
