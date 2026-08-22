import { useState, type CSSProperties } from 'react'
import { useGameStore } from '../game/state/store'
import { computeStorageCaps } from '../game/engine/storage'
import { computeProductionRatesPerSecond } from '../game/engine/production'
import { RESOURCE_ICONS, RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatCompact } from '../game/utils/formatResources'
import { RESOURCE_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { useValueFlash } from './useValueFlash'
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
  /*
   * §17 item 1. The gain threshold is measured against the *cap*, not the current value: a
   * value-relative threshold collapses after a big spend, and a late-game drip would then
   * clear it every 250ms tick and leave the strip permanently green. 2% of storage is far
   * above any per-tick trickle and far below any payout worth noticing. A resource sitting
   * at cap is already red and gains nothing, so its flash is suppressed outright.
   */
  const flash = useValueFlash(
    state.resources,
    (key) => Math.max(1, 0.02 * caps[key]),
    (key) => state.resources[key] >= caps[key],
  )
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
        {RESOURCE_KEYS.map((key) => {
          const atCap = state.resources[key] >= caps[key]
          /*
           * §10's cap-as-hairline. The strip has always shown a bare number, so "how full is
           * my Spirit Wood" needed a tap into the expanded panel; a 2px rule under each chip
           * answers it at a glance and costs no vertical space the strip wasn't already using.
           */
          const fullness = caps[key] > 0 ? Math.min(1, state.resources[key] / caps[key]) : 0
          return (
            <span className={`resource-chip ${atCap ? 'at-cap' : ''}`} key={key}>
              <GameIcon src={RESOURCE_ART[key]} fallback={RESOURCE_ICONS[key]} alt="" size={20} />
              <span className={`resource-chip-value ${atCap ? 'at-cap' : ''} ${flash[key] ?? ''}`}>
                {formatCompact(state.resources[key])}
              </span>
              <span
                className="resource-chip-cap"
                style={{ '--fill': `${(fullness * 100).toFixed(1)}%` } as CSSProperties}
                aria-hidden="true"
              />
            </span>
          )
        })}
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
                    <span className={`resource-amount ${value >= cap ? 'at-cap' : ''} ${flash[key] ?? ''}`}>
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
