import { getSpiritVeinDef } from '../game/data/world/spiritVeinDefs'

/**
 * Shows a province's Spirit Vein tier as its derived name + effect (§7 / §12.5).
 * The name comes from spiritVeinDefs via the tier — never a stored label.
 */
export function SpiritVeinBadge({ tier }: { tier: number }) {
  const vein = getSpiritVeinDef(tier)
  return (
    <span className="spirit-vein-badge" title={vein.notes ?? undefined}>
      <strong>{vein.name} Spirit Vein</strong>
      <span className="panel-hint">
        {' '}cultivation ×{vein.cultivationMult}, recruit quality ×{vein.recruitQualityMult}
      </span>
    </span>
  )
}
