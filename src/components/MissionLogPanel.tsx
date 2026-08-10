import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getMissionDef } from '../game/data/missionDefs'
import { getOutcomeLabel } from '../game/engine/missions'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import type { MissionLogEntry, Resources } from '../game/types'
import { BattleReportView } from './BattleReportView'
import { CollapsibleList } from './CollapsibleList'

function formatReward(reward: Partial<Resources>): string {
  const entries = Object.entries(reward) as [keyof Resources, number][]
  if (entries.length === 0) return 'none'
  return entries.map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`).join(', ')
}

export function MissionLogPanel() {
  const missionLog = useGameStore((s) => s.state.missionLog)
  const [openEntry, setOpenEntry] = useState<MissionLogEntry | null>(null)

  if (missionLog.length === 0) return null

  return (
    <section className="panel mission-log-panel">
      <h2>Recent Missions</h2>
      <CollapsibleList
        items={missionLog.map((entry) => {
          const def = getMissionDef(entry.defId)
          // A combat mission that ended in a mutual retreat (Phase 9) reads as a stalemate rather than the reward-based Success/Failure label.
          const label = entry.battleResult?.outcomeTier === 'draw' ? 'Draw' : getOutcomeLabel(def, entry.outcome)
          return (
            <li key={entry.id} className={`mission-log-entry ${entry.outcome === 'Success' ? 'success' : 'failure'}`}>
              <strong>{entry.missionName}</strong> &mdash; {label}
              {entry.battleResult && <button onClick={() => setOpenEntry(entry)}>View Battle Report</button>}
              <br />
              <span className="panel-hint">
                Squad: {entry.squadNames.join(', ')} &middot; Reward: {formatReward(entry.rewardGranted)}
                {entry.injuries.length > 0 &&
                  ` · Injured: ${entry.injuries.map((i) => `${i.name} (${i.severity})`).join(', ')}`}
              </span>
            </li>
          )
        })}
      />
      {openEntry?.battleResult && (
        <BattleReportView
          battle={openEntry.battleResult}
          title={openEntry.missionName}
          participantNames={openEntry.squadNames}
          participantTemperaments={openEntry.squadTemperaments}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </section>
  )
}
