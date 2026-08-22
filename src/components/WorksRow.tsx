import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'
import { BUILDING_ART } from '../assets/icons'
import { GameIcon } from './GameIcon'
import { getBuildingHoldLine, getBuildingMetaLine } from './buildingRowMeta'
import { formatCountdown } from '../game/utils/formatDuration'

interface WorksRowProps {
  buildingId: string
  onSelect: (id: string) => void
  /** Set only on the row pulled out under "Under construction" — it carries the bar and the countdown. */
  raising?: boolean
  /** Total duration of the running upgrade, so the bar can show how far along it is. */
  durationMs?: number
}

/**
 * One building, full width.
 *
 * REPLACES `.building-tile`'s 2-up grid, and §19's preserve list is deliberately overridden
 * here — the reasoning is in `BUILDINGS_SCREEN_MOCKUP_PROMPT.md` deviation 1. In short: the
 * grid was preserved because it worked for a tile carrying a name and a level. This card
 * carries six values, and `+2.00 Spirit Stones/s · 2 / 3 worked` cannot live in a 224px cell
 * without ellipsis — which is exactly why every other fact had to be pushed into a sheet.
 *
 * Anatomy is §8's card header, which the design system already assigns to this family:
 * `[art 48] [name + one metadata line] [value]`, plus a foot line only when there is
 * something to say.
 */
export function WorksRow({ buildingId, onSelect, raising = false, durationMs }: WorksRowProps) {
  // Subscribing to the whole state so a running countdown re-renders every tick, the same
  // choice BuildingDetailPanel makes and for the same reason.
  const state = useGameStore((s) => s.state)
  const building = state.buildings[buildingId]
  const def = getBuildingDef(buildingId)
  if (!building) return null

  const remainingMs = Math.max(0, (building.constructionEndsAt ?? 0) - Date.now())
  const hold = getBuildingHoldLine(state, buildingId)
  const meta = raising ? `Raising to Level ${building.level + 1}` : getBuildingMetaLine(state, buildingId)
  const foot = raising ? `${formatCountdown(remainingMs)} remaining` : hold

  // A row is "held" only when it is at the cap and nothing is being built on it. Over-level
  // is its own, louder state — it costs output rather than merely blocking an upgrade.
  const stateClass = raising
    ? 'raising'
    : building.level > (state.buildings.sectHall?.level ?? 1)
      ? 'over-level'
      : hold
        ? 'held'
        : ''

  return (
    <button
      type="button"
      className={`works-row ${stateClass}`}
      data-building-id={buildingId}
      onClick={() => onSelect(buildingId)}
    >
      <GameIcon className="works-row-art" src={BUILDING_ART[buildingId]} fallback="🏯" alt="" size={48} />
      <span className="works-row-text">
        <span className="works-row-name">{def.name}</span>
        <span className="works-row-meta">{meta}</span>
        {raising && durationMs ? (
          <span className="progress-bar works-row-bar">
            <span
              className="progress-bar-fill construction"
              style={{ width: `${Math.min(100, Math.max(0, 100 - (remainingMs / durationMs) * 100))}%` }}
            />
          </span>
        ) : null}
        {foot && <span className="works-row-foot">{foot}</span>}
      </span>
      <span className="works-row-level">Lv{building.level}</span>
    </button>
  )
}

/** The unclaimed-slot row. One row for the whole remainder, not one per slot — the count is the information. */
export function ClaimRow({ open, onSelect }: { open: number; onSelect: () => void }) {
  return (
    <button type="button" className="works-row works-row-claim" onClick={onSelect}>
      <GameIcon className="works-row-art" fallback="＋" alt="" size={48} />
      <span className="works-row-text">
        <span className="works-row-name">Choose Specialization</span>
        <span className="works-row-meta">Claim a slot to add a building to the sect</span>
      </span>
      <span className="works-row-level">
        {open} {open === 1 ? 'slot' : 'slots'}
      </span>
    </button>
  )
}
