import { useGameStore } from '../game/state/store'

export function EventLogPanel() {
  const eventLog = useGameStore((s) => s.state.eventLog)

  if (eventLog.length === 0) return null

  return (
    <section className="panel event-log-panel">
      <h2>Sect Chronicle</h2>
      <p className="panel-hint">Resolved world and narrative events, newest first.</p>
      <ul className="mission-log-list">
        {eventLog.map((entry) => (
          <li key={entry.id} className={`mission-log-entry ${entry.source}`}>
            <strong>{entry.name}</strong> &mdash;{' '}
            {entry.source === 'world'
              ? 'World Event'
              : entry.source === 'sect'
                ? 'Sect'
                : entry.source === 'npcSim'
                  ? 'The Wider World'
                  : 'Narrative Event'}
            <br />
            <span className="panel-hint">{entry.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
