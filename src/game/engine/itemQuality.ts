import type { ItemQuality } from '../types'
import { ITEM_QUALITY_DEFS, getItemQualityDef } from '../data/itemQualityDefs'
import { getItemDef } from '../data/itemDefs'

/** Weighted random quality roll (doc 07 §7). Called when an equipment item is crafted or earned. */
export function rollItemQuality(): ItemQuality {
  const total = ITEM_QUALITY_DEFS.reduce((sum, def) => sum + def.rollWeight, 0)
  let roll = Math.random() * total
  for (const def of ITEM_QUALITY_DEFS) {
    roll -= def.rollWeight
    if (roll < 0) return def.id
  }
  return ITEM_QUALITY_DEFS[ITEM_QUALITY_DEFS.length - 1].id
}

/** CP multiplier for a quality tier; 1 when quality is absent (non-equipment / legacy). */
export function getQualityMultiplier(quality: ItemQuality | undefined): number {
  if (quality === undefined) return 1
  return getItemQualityDef(quality).cpMultiplier
}

/** Effective Combat Power an equipment def contributes at a given quality (doc 06 §2 equipment CP input, quality-scaled). */
export function getEquipmentCombatPower(itemDefId: string, quality: ItemQuality | undefined): number {
  const base = getItemDef(itemDefId).combatPowerBonus ?? 0
  return Math.round(base * getQualityMultiplier(quality))
}

/** Display name including quality for equipment (e.g. "Iron Sword (Fine)"); plain name when no quality. */
export function getItemDisplayName(itemDefId: string, quality: ItemQuality | undefined): string {
  const name = getItemDef(itemDefId).name
  return quality !== undefined ? `${name} (${quality})` : name
}
