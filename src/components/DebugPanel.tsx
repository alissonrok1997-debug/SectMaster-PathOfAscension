import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { DEFAULT_HEALTH_REGEN_PER_SECOND, getHealthRegenPerSecond, MAX_HP, setHealthRegenPerSecond } from '../game/engine/injury'

export function DebugPanel() {
  const debugAddResources = useGameStore((s) => s.debugAddResources)
  const debugAddMaterials = useGameStore((s) => s.debugAddMaterials)
  const debugDamageSectHall = useGameStore((s) => s.debugDamageSectHall)
  const debugSimulateOfflineGap = useGameStore((s) => s.debugSimulateOfflineGap)
  const debugForceWorldEvent = useGameStore((s) => s.debugForceWorldEvent)
  const debugForceEvent = useGameStore((s) => s.debugForceEvent)

  // Live health-regen tuning knob (not persisted — resets on reload). Local state just mirrors the module value so the display refreshes on click.
  const [regen, setRegen] = useState(getHealthRegenPerSecond())
  const adjustRegen = (delta: number) => {
    setHealthRegenPerSecond(getHealthRegenPerSecond() + delta)
    setRegen(getHealthRegenPerSecond())
  }

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
        <button onClick={debugAddMaterials}>+60 All Crafting Materials</button>
        <button className="danger" onClick={debugDamageSectHall}>
          Damage Sect Hall (-2 levels)
        </button>
        <button onClick={() => debugSimulateOfflineGap(2)}>Simulate 2h Offline Gap</button>
        <button onClick={() => debugSimulateOfflineGap(10)}>Simulate 10h Offline Gap (tests cap)</button>
        <button onClick={debugForceWorldEvent}>Force World Event Now</button>
        <button onClick={debugForceEvent}>Force Narrative Event Now</button>
      </div>

      <h3 className="debug-subheading">
        Health Regen: {regen.toFixed(3)} /s of max HP ({(regen * MAX_HP).toFixed(2)} HP/s at {MAX_HP} max)
      </h3>
      <p className="panel-hint">Tune the flat HP regen rate live (not saved — resets on reload). Default {DEFAULT_HEALTH_REGEN_PER_SECOND}.</p>
      <div className="save-controls-buttons">
        <button onClick={() => adjustRegen(-0.1)} disabled={regen <= 0}>
          −0.1
        </button>
        <button onClick={() => adjustRegen(-0.01)} disabled={regen <= 0}>
          −0.01
        </button>
        <button onClick={() => adjustRegen(0.01)}>+0.01</button>
        <button onClick={() => adjustRegen(0.1)}>+0.1</button>
        <button onClick={() => { setHealthRegenPerSecond(DEFAULT_HEALTH_REGEN_PER_SECOND); setRegen(getHealthRegenPerSecond()) }}>Reset</button>
      </div>
    </section>
  )
}
