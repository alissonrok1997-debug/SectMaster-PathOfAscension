interface EmptySlotTileProps {
  slotId: string
  active: boolean
  onSelect: (id: string) => void
}

/** Placeholder tile for an unclaimed specialization slot — opens the picker drawer instead of a detail panel. */
export function EmptySlotTile({ slotId, active, onSelect }: EmptySlotTileProps) {
  return (
    <button
      type="button"
      className={`building-tile building-tile-empty ${active ? 'building-tile-active' : ''}`}
      data-building-id={slotId}
      aria-expanded={active}
      onClick={() => onSelect(slotId)}
    >
      <span className="building-tile-name">+ Choose Specialization</span>
    </button>
  )
}
