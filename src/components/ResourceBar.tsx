import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { computeStorageCaps } from '../game/engine/storage'
import { computeProductionRatesPerSecond } from '../game/engine/production'
import { RESOURCE_ICONS, RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatCompact } from '../game/utils/formatResources'
import { RESOURCE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import type { Resources } from '../game/types'

const RESOURCE_KEYS = Object.keys(RESOURCE_LABELS) as (keyof Resources)[]

/**
 * Fixed one-line resource readout. Caps and per-hour rates matter when deciding what to
 * build, not on every tick, so they live behind a tap in the expanded panel.
 */
export function ResourceBar() {
  // Subscribing to the whole state so values re-render every tick.
  const state = useGameStore((s) => s.state)
  const [expanded, setExpanded] = useState(false)
  const caps = computeStorageCaps(state)
  // Only needed by the expanded panel — skip the work on the ~every-tick collapsed render.
  const ratesPerSecond = expanded ? computeProductionRatesPerSecond(state) : undefined

  return (
    <>
      <button
        type="button"
        className="resource-strip"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {RESOURCE_KEYS.map((key) => (
          <span className="resource-chip" key={key}>
            <GameIcon src={RESOURCE_ART[key]} fallback={RESOURCE_ICONS[key]} alt="" size={20} />
            <span className={`resource-chip-value ${state.resources[key] >= caps[key] ? 'at-cap' : ''}`}>
              {formatCompact(state.resources[key])}
            </span>
          </span>
        ))}
      </button>

      {expanded && (
        <>
          <div className="resource-scrim" onClick={() => setExpanded(false)} />
          <div className="resource-detail">
            <div className="resource-grid">
              {RESOURCE_KEYS.map((key) => {
                const value = state.resources[key]
                const cap = caps[key]
                const perHour = (ratesPerSecond?.[key] ?? 0) * 3600
                return (
                  <div className="resource-tile" key={key}>
                    <GameIcon
                      className="resource-icon"
                      src={RESOURCE_ART[key]}
                      fallback={RESOURCE_ICONS[key]}
                      alt=""
                      size={40}
                    />
                    <span className="resource-label">{RESOURCE_LABELS[key]}</span>
                    <span className={`resource-amount ${value >= cap ? 'at-cap' : ''}`}>
                      {Math.floor(value).toLocaleString()} / {Math.floor(cap).toLocaleString()}
                    </span>
                    {perHour > 0 && <span className="resource-rate">+{perHour.toFixed(0)}/hr</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
