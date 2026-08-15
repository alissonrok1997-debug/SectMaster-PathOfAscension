import type { ItemQuality } from '../types'

export interface ItemQualityDefinition {
  id: ItemQuality
  label: string
  /** Multiplier applied to an equipment piece's base Combat Power (doc 07 §7 "Quality affects base stats"). Dev-placeholder scale. */
  cpMultiplier: number
  /** Relative weight in the craft/drop quality roll (doc 07 §7). Dev-placeholder — Normal common, Masterwork rare. */
  rollWeight: number
  /**
   * UI tint for the quality label. A design-system colour token, not a literal — rarity
   * colour is fixed game-wide (GAME_UI_DESIGN_SYSTEM §2.2) and this is its one source.
   * Only ever consumed by inline `style`, where `var()` resolves normally.
   */
  color: string
}

/** doc 07 §7 quality ladder, worst to best. */
export const ITEM_QUALITY_DEFS: ItemQualityDefinition[] = [
  { id: 'Poor', label: 'Poor', cpMultiplier: 0.8, rollWeight: 15, color: 'var(--text-4)' },
  { id: 'Normal', label: 'Normal', cpMultiplier: 1.0, rollWeight: 45, color: 'var(--text-2)' },
  { id: 'Fine', label: 'Fine', cpMultiplier: 1.15, rollWeight: 25, color: 'var(--positive)' },
  { id: 'Excellent', label: 'Excellent', cpMultiplier: 1.3, rollWeight: 10, color: 'var(--info)' },
  { id: 'Perfect', label: 'Perfect', cpMultiplier: 1.5, rollWeight: 4, color: 'var(--rare)' },
  { id: 'Masterwork', label: 'Masterwork', cpMultiplier: 1.75, rollWeight: 1, color: 'var(--gold)' },
]

export function getItemQualityDef(quality: ItemQuality): ItemQualityDefinition {
  const def = ITEM_QUALITY_DEFS.find((d) => d.id === quality)
  if (!def) throw new Error(`Unknown item quality: ${quality}`)
  return def
}
