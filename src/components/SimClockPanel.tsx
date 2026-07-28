import { useGameStore } from '../game/state/store'

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function SimClockPanel() {
  const totalElapsedMs = useGameStore((s) => s.state.simClock.totalElapsedMs)

  return (
    <section className="panel">
      <h2>Simulation Clock</h2>
      <p className="panel-hint">Real time. 1 real second = 1 simulated second, never accelerated.</p>
      <div className="clock-readout">{formatDuration(totalElapsedMs)}</div>
    </section>
  )
}
