import { useGameStore } from '../game/state/store'

export function DebugPanel() {
  const debugAddResources = useGameStore((s) => s.debugAddResources)
  const debugDamageSectHall = useGameStore((s) => s.debugDamageSectHall)
  const debugSimulateOfflineGap = useGameStore((s) => s.debugSimulateOfflineGap)
  const debugForceWorldEvent = useGameStore((s) => s.debugForceWorldEvent)
  const debugForceEvent = useGameStore((s) => s.debugForceEvent)

  return (
    <section className="panel debug-panel">
      <h2>Debug / Testing</h2>
      <p className="panel-hint">
        Dev-only shortcuts for exercising mechanics that don't have their real trigger yet. Missions now trigger
        Presence Requirement and Injury for real (see the Mission Board below) — Sect Hall damage still has no
        real trigger until Sect Conflict/building destruction exists (Wave 9). World/narrative events already have
        a real timer trigger — the two buttons below just fast-forward it for testing, they aren't a missing-trigger
        stand-in.
      </p>
      <div className="save-controls-buttons">
        <button onClick={debugAddResources}>+200 All Resources</button>
        <button className="danger" onClick={debugDamageSectHall}>
          Damage Sect Hall (-2 levels)
        </button>
        <button onClick={() => debugSimulateOfflineGap(2)}>Simulate 2h Offline Gap</button>
        <button onClick={() => debugSimulateOfflineGap(10)}>Simulate 10h Offline Gap (tests cap)</button>
        <button onClick={debugForceWorldEvent}>Force World Event Now</button>
        <button onClick={debugForceEvent}>Force Narrative Event Now</button>
      </div>
    </section>
  )
}
