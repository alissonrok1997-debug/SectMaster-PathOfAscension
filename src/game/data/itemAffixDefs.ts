import type { EquipmentEffectId, EquipmentSlotType, ItemAffix, ItemQuality } from '../types'

/**
 * EQUIPMENT_DEPTH_PLAN §4 — the affix pool. Each def is one bonus an equipment instance can roll at
 * creation, weighted, with a value range and the slot types it's allowed on (a weapon does not roll
 * "Mending"). Every `effectId` has a single engine consumer routed through getEquippedEffectTotal
 * (engine/itemAffixes.ts) — no stubs. Values are stored as positive magnitudes; consumers apply the sign
 * (a Warding roll of 8 means −8% wound damage).
 */
export interface AffixDefinition {
  id: string
  /** Short evocative name shown before the item's base name in tooltips (e.g. "Keen"). */
  name: string
  effectId: EquipmentEffectId
  /** Slot types this affix may roll on. */
  slots: EquipmentSlotType[]
  /** Inclusive value range, in the effect's own unit (CP for flat, percentage points for pct effects). */
  min: number
  max: number
  /** Relative weight in the affix roll. */
  weight: number
  /** Whether the effect is a bonus (+) or a reduction (−), for display only — the engine already knows the sign. */
  sign: '+' | '-'
  /** Unit suffix for display: '' for flat CP, '%' for percentage effects. */
  unit: '' | '%'
}

export const ITEM_AFFIX_DEFS: AffixDefinition[] = [
  { id: 'keen', name: 'Keen', effectId: 'combatPowerFlat', slots: ['Weapon', 'Accessory'], min: 3, max: 6, weight: 20, sign: '+', unit: '' },
  { id: 'ferocious', name: 'Ferocious', effectId: 'combatPowerPct', slots: ['Weapon', 'Accessory'], min: 5, max: 12, weight: 16, sign: '+', unit: '%' },
  { id: 'ironhide', name: 'Ironhide', effectId: 'maxHpPct', slots: ['Armor', 'Accessory'], min: 6, max: 14, weight: 16, sign: '+', unit: '%' },
  { id: 'qiGathering', name: 'Qi-Gathering', effectId: 'cultivationRatePct', slots: ['Armor', 'Accessory'], min: 4, max: 9, weight: 14, sign: '+', unit: '%' },
  { id: 'warding', name: 'Warding', effectId: 'woundResistPct', slots: ['Armor', 'Accessory'], min: 5, max: 12, weight: 14, sign: '-', unit: '%' },
  { id: 'mending', name: 'Mending', effectId: 'healthRegenPct', slots: ['Armor', 'Accessory'], min: 10, max: 20, weight: 12, sign: '+', unit: '%' },
  { id: 'comforting', name: 'Comforting', effectId: 'moraleDecayPct', slots: ['Accessory'], min: 10, max: 20, weight: 12, sign: '-', unit: '%' },
]

export function getAffixDef(id: string): AffixDefinition {
  const def = ITEM_AFFIX_DEFS.find((a) => a.id === id)
  if (!def) throw new Error(`Unknown affix id: ${id}`)
  return def
}

/** Tooltip label for a rolled affix, e.g. "Keen +5" or "Warding −8%" (§4 shows honest raw values). */
export function describeAffix(affix: ItemAffix): string {
  const def = getAffixDef(affix.affixId)
  return `${def.name} ${def.sign}${affix.value}${def.unit}`
}

/**
 * §4 — affix count by Quality tier. Poor/Normal are plain; the interesting rolls start at Fine, and the
 * two top tiers carry a second affix. Masterwork additionally rolls its values in the upper half (see
 * engine/itemAffixes.ts), so it feels decisively better rather than merely luckier.
 */
export const AFFIX_COUNT_BY_QUALITY: Record<ItemQuality, number> = {
  Poor: 0,
  Normal: 0,
  Fine: 1,
  Excellent: 1,
  Perfect: 2,
  Masterwork: 2,
}
