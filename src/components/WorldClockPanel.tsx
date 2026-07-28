import { useGameStore } from '../game/state/store'
import { msToWorldTime } from '../game/engine/worldClock'

export function WorldClockPanel() {
  const totalElapsedMs = useGameStore((s) => s.state.worldClock.totalElapsedMs)
  const { day, timeOfDay, progress } = msToWorldTime(totalElapsedMs)

  return (
    <section className="panel">
      <h2>World Clock</h2>
      <p className="panel-hint">Cosmetic only. 1 in-game day = 30 real minutes (20 day / 10 night).</p>
      <div className="world-clock-readout">
        <span className="world-clock-icon">{timeOfDay === 'day' ? '☀️' : '\u{1F319}'}</span>
        <span>
          Day {day} &middot; {timeOfDay === 'day' ? 'Daytime' : 'Night'}
        </span>
      </div>
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${timeOfDay}`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </section>
  )
}
