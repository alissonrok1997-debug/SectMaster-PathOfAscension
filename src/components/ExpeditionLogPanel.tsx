import { useState } from 'react'
import type { ExpeditionLogEntry, Resources } from '../game/types'
import { useGameStore } from '../game/state/store'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { BattleReportView } from './BattleReportView'

function haulLine(entry: ExpeditionLogEntry): string {
  if (entry.battleResult) return entry.battleResult.outcomeSummary
  if (entry.purpose === 'survey') return 'surveyed'
  if (entry.purpose === 'claim') return 'outpost established'
  const entries = Object.entries(entry.payload.resources) as [keyof Resources, number][]
  if (entries.length === 0) return 'no haul'
  return entries.map(([key, amount]) => `+${Math.floor(amount)} ${RESOURCE_LABELS[key]}`).join(', ')
}

/** Newest-first arrival reports (WORLD_MAP_DESIGN §12.3), mirroring MissionLogPanel. Claim/Raid entries with a battleResult (FIRST_REALM_PLAN §4.7) open the regenerated BattleReportView. */
export function ExpeditionLogPanel() {
  const log = useGameStore((s) => s.state.world?.expeditionLog ?? [])
  const [openEntry, setOpenEntry] = useState<ExpeditionLogEntry | null>(null)
  if (log.length === 0) return null

  return (
    <section className="panel expedition-log-panel">
      <h2>Expedition Log</h2>
      <ul className="event-log-list">
        {log.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.locationName}</strong> — {haulLine(entry)} ({entry.discipleNames.join(', ')})
            {entry.battleResult && <button onClick={() => setOpenEntry(entry)}>View Battle Report</button>}
            {entry.incidents.length > 0 && (
              <ul>
                {entry.incidents.map((incident, i) => (
                  <li key={i} className="panel-hint">
                    {incident.description}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {openEntry?.battleResult && (
        <BattleReportView
          battle={openEntry.battleResult}
          title={openEntry.locationName}
          participantNames={openEntry.discipleNames}
          participantTemperaments={openEntry.discipleTemperaments}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </section>
  )
}
