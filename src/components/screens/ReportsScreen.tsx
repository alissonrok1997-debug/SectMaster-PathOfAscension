import { useEffect, useState } from 'react'
import { useGameStore } from '../../game/state/store'
import type { CombatReportSource } from '../../game/types'
import { BattleReportBody } from '../BattleReportView'
import { ReportCard } from '../ReportCard'

type SourceFilter = 'all' | CombatReportSource

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mission', label: 'Missions' },
  { id: 'expedition', label: 'Expeditions' },
  { id: 'defense', label: 'Defenses' },
]

export function ReportsScreen() {
  const reports = useGameStore((s) => s.state.reports)
  const markReportRead = useGameStore((s) => s.markReportRead)
  const markAllReportsRead = useGameStore((s) => s.markAllReportsRead)

  // Filters are pure local state — not persisted. Source chips single-select; "Unread only" is an independent toggle.
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const matchesFilters = (r: (typeof reports)[number], source: SourceFilter) =>
    (source === 'all' || r.source === source) && (!unreadOnly || !r.read)
  const filtered = reports.filter((r) => matchesFilters(r, sourceFilter))
  // Looked up in `reports`, not `filtered`: changing a filter while a report is open
  // must not close it out from under the reader.
  const selected = selectedId ? (reports.find((r) => r.id === selectedId) ?? null) : null

  // Opening a report is what marks it read (mail semantics) — nothing is auto-opened.
  useEffect(() => {
    if (selected && !selected.read) markReportRead(selected.id)
  }, [selected, markReportRead])

  const unreadCount = reports.filter((r) => !r.read).length
  const now = Date.now()

  // Full-screen sub-view: the report owns the screen, with a back affordance.
  if (selected) {
    return (
      <section className="panel reports-screen">
        <div className="world-back-header">
          <button className="world-back-button" onClick={() => setSelectedId(null)} aria-label="Back to inbox">
            ‹
          </button>
          <h2>{selected.title}</h2>
        </div>
        <BattleReportBody
          battle={selected.battle}
          title={selected.title}
          participantNames={selected.participantNames}
          participantTemperaments={selected.participantTemperaments}
        />
      </section>
    )
  }

  return (
    <section className="panel reports-screen">
      <div className="reports-toolbar">
        <div className="reports-filter-chips">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={f.id === sourceFilter ? 'chip active' : 'chip'}
              onClick={() => setSourceFilter(f.id)}
            >
              {/* Counts make filtering an informed choice rather than a guess. */}
              {f.label} {reports.filter((r) => matchesFilters(r, f.id)).length}
            </button>
          ))}
          <label className="reports-unread-toggle">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="reports-mark-all" onClick={markAllReportsRead}>
            Mark all read
          </button>
        )}
      </div>

      {reports.length === 0 ? (
        <p className="panel-hint">
          No battle reports yet. Send a squad on a Hunting mission, or claim a location on the world map.
        </p>
      ) : (
        <div className="reports-list">
          {filtered.length === 0 ? (
            <p className="panel-hint">No reports match this filter.</p>
          ) : (
            filtered.map((r) => (
              <ReportCard key={r.id} entry={r} selected={false} now={now} onSelect={() => setSelectedId(r.id)} />
            ))
          )}
        </div>
      )}
    </section>
  )
}
