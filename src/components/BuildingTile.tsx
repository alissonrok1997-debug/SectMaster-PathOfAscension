import { useGameStore } from '../game/state/store'
import { getBuildingDef } from '../game/data/buildingDefs'

interface BuildingTileProps {
  buildingId: string
  active: boolean
  onSelect: (id: string) => void
}

export function BuildingTile({ buildingId, active, onSelect }: BuildingTileProps) {
  const level = useGameStore((s) => s.state.buildings[buildingId]?.level ?? 1)
  const def = getBuildingDef(buildingId)

  return (
    <button
      type="button"
      className={`building-tile ${active ? 'building-tile-active' : ''}`}
      data-building-id={buildingId}
      aria-expanded={active}
      onClick={() => onSelect(buildingId)}
    >
      <span className="building-tile-name">{def.name}</span>
      <span className="building-tile-level">Lv{level}</span>
    </button>
  )
}
