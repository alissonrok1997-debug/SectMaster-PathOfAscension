import { useGameStore } from '../game/state/store'
import { getMissionDef } from '../game/data/missionDefs'
import { formatCountdown } from '../game/utils/formatDuration'

export function ActiveMissionsPanel() {
  // Subscribing to the whole state so the return countdown re-renders every tick.
  const state = useGameStore((s) => s.state)

  if (state.activeMissions.length === 0) return null

  return (
    <section className="panel active-missions-panel">
      <h2>Squads in the Field</h2>
      <div className="active-mission-list">
        {state.activeMissions.map((mission) => {
          const def = getMissionDef(mission.defId)
          const squadNames = mission.squadDiscipleIds
            .map((id) => state.disciples.find((d) => d.id === id)?.name)
            .filter((name): name is string => name !== undefined)
          const remaining = Math.max(0, mission.endsAt - Date.now())
          const totalDuration = mission.endsAt - mission.startedAt
          const progress = totalDuration > 0 ? Math.min(100, 100 - (remaining / totalDuration) * 100) : 100

          return (
            <div className="active-mission-card" key={mission.id}>
              <div className="active-mission-header">
                <strong>{def.name}</strong>
                <span>{formatCountdown(remaining)} remaining</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill day" style={{ width: `${progress}%` }} />
              </div>
              <p className="panel-hint">Squad: {squadNames.join(', ')}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
