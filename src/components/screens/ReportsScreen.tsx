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

  const filtered = reports.filter(
    (r) => (sourceFilter === 'all' || r.source === sourceFilter) && (!unreadOnly || !r.read),
  )
  // Selection defaults to the first of the current list; if it falls out (filter change / trim), fall back to the new first.
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  // Whatever is shown in the detail pane is "opened" → mark it read (mail semantics).
  useEffect(() => {
    if (selected && !selected.read) markReportRead(selected.id)
  }, [selected, markReportRead])

  const unreadCount = reports.filter((r) => !r.read).length
  const now = Date.now()

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
              {f.label}
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
        <div className="reports-grid">
          <div className="reports-list">
            {filtered.length === 0 ? (
              <p className="panel-hint">No reports match this filter.</p>
            ) : (
              filtered.map((r) => (
                <ReportCard
                  key={r.id}
                  entry={r}
                  selected={selected?.id === r.id}
                  now={now}
                  onSelect={() => {
                    setSelectedId(r.id)
                    markReportRead(r.id)
                  }}
                />
              ))
            )}
          </div>
          <div className="reports-detail">
            {selected ? (
              <BattleReportBody
                battle={selected.battle}
                title={selected.title}
                participantNames={selected.participantNames}
                participantTemperaments={selected.participantTemperaments}
              />
            ) : (
              <p className="panel-hint">Select a report to read it.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
