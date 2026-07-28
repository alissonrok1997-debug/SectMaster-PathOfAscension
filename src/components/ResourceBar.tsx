import { useGameStore } from '../game/state/store'
import { computeStorageCaps } from '../game/engine/storage'
import { computeProductionRatesPerSecond } from '../game/engine/production'
import { RESOURCE_ICONS, RESOURCE_LABELS } from '../game/data/resourceLabels'
import type { Resources } from '../game/types'

export function ResourceBar() {
  // Subscribing to the whole state so the per-hour rate re-renders every tick.
  const state = useGameStore((s) => s.state)
  const caps = computeStorageCaps(state)
  const ratesPerSecond = computeProductionRatesPerSecond(state)

  return (
    <section className="panel resource-bar">
      <h2>Resources</h2>
      <div className="resource-grid">
        {(Object.keys(RESOURCE_LABELS) as (keyof Resources)[]).map((key) => {
          const value = state.resources[key]
          const cap = caps[key]
          const atCap = value >= cap
          const perHour = ratesPerSecond[key] * 3600
          return (
            <div className="resource-tile" key={key}>
              <span className="resource-icon">{RESOURCE_ICONS[key]}</span>
              <span className="resource-label">{RESOURCE_LABELS[key]}</span>
              <span className={`resource-amount ${atCap ? 'at-cap' : ''}`}>
                {Math.floor(value).toLocaleString()} / {Math.floor(cap).toLocaleString()}
              </span>
              {perHour > 0 && <span className="resource-rate">+{perHour.toFixed(0)}/hr</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
