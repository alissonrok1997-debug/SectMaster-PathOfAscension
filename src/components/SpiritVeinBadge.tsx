import { getSpiritVeinDef } from '../game/data/world/spiritVeinDefs'

/**
 * Shows a province's Spirit Vein tier as its derived name + effect (§7 / §12.5).
 * The name comes from spiritVeinDefs via the tier — never a stored label.
 */
export function SpiritVeinBadge({ tier }: { tier: number }) {
  const vein = getSpiritVeinDef(tier)

  /*
   * §14, inline disclosure. `vein.notes` sat in a native `title=` and was therefore
   * unreadable on a touch device — the badge promised context it could never deliver. It is
   * one short sentence, so it is simply shown.
   */
  return (
    <span className="spirit-vein-badge">
      <strong>{vein.name} Spirit Vein</strong>
      <span className="panel-hint">
        {' '}cultivation ×{vein.cultivationMult}, recruit quality ×{vein.recruitQualityMult}
      </span>
      {vein.notes && <span className="spirit-vein-note">{vein.notes}</span>}
    </span>
  )
}
