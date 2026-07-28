import { useGameStore } from '../game/state/store'
import { getMissionDef } from '../game/data/missionDefs'
import { getOutcomeLabel } from '../game/engine/missions'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import type { Resources } from '../game/types'

function formatReward(reward: Partial<Resources>): string {
  const entries = Object.entries(reward) as [keyof Resources, number][]
  if (entries.length === 0) return 'none'
  return entries.map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`).join(', ')
}

export function MissionLogPanel() {
  const missionLog = useGameStore((s) => s.state.missionLog)

  if (missionLog.length === 0) return null

  return (
    <section className="panel mission-log-panel">
      <h2>Recent Missions</h2>
      <ul className="mission-log-list">
        {missionLog.map((entry) => {
          const def = getMissionDef(entry.defId)
          const label = getOutcomeLabel(def, entry.outcome)
          return (
            <li key={entry.id} className={`mission-log-entry ${entry.outcome === 'Success' ? 'success' : 'failure'}`}>
              <strong>{entry.missionName}</strong> &mdash; {label}
              <br />
              <span className="panel-hint">
                Squad: {entry.squadNames.join(', ')} &middot; Reward: {formatReward(entry.rewardGranted)}
                {entry.injuries.length > 0 &&
                  ` · Injured: ${entry.injuries.map((i) => `${i.name} (${i.severity})`).join(', ')}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
