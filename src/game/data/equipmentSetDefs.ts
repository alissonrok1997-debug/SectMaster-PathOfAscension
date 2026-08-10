import type { EquipmentEffectId } from '../types'

/**
 * EQUIPMENT_DEPTH_PLAN §5 — named equipment sets. A set bonus reuses the exact §4 effect union, so sets
 * add zero new consumers and zero new tooltip vocabulary: getEquippedEffectTotal (engine/itemAffixes.ts)
 * simply gains one more summed term. Membership is derived from what a single disciple has equipped —
 * there is no persisted set field. Bonuses tier at 2 and 3 pieces (not 4: two of the four slots are
 * accessories, and a 4-piece gate would force every set to lock both).
 */
export interface EquipmentSetBonus {
  /** Pieces of the set that must be equipped (on the same disciple) for this bonus to apply. */
  count: number
  effectId: EquipmentEffectId
  /** Magnitude in the effect's own unit (CP for flat, percentage points for pct). Reductions are stored positive; the consumer applies the sign. */
  value: number
}

export interface EquipmentSetDefinition {
  id: string
  name: string
  /** One line surfaced in the disciple panel while the set is active — a set the player can't name is just a hidden multiplier. */
  lore: string
  /** Item def ids that count toward the set. */
  pieces: string[]
  bonuses: EquipmentSetBonus[]
}

export const EQUIPMENT_SET_DEFS: EquipmentSetDefinition[] = [
  {
    id: 'ironSentinel',
    name: 'Iron Sentinel',
    lore: 'The frontline kit of a hundred nameless sects — cheap iron, honest leather, and a jade band to steady the hand.',
    pieces: ['ironSword', 'leatherVest', 'jadeRing'],
    bonuses: [
      { count: 2, effectId: 'combatPowerFlat', value: 5 },
      { count: 3, effectId: 'woundResistPct', value: 10 },
    ],
  },
  {
    id: 'verdantScholar',
    name: 'Verdant Scholar',
    lore: 'Worn by those who never lift a blade — the robe, the talisman, and the pendant of a disciple who intends to outlast every war by cultivating through it.',
    pieces: ['clothRobe', 'talismanOfVigor', 'jadePendant'],
    bonuses: [
      { count: 2, effectId: 'cultivationRatePct', value: 5 },
      { count: 3, effectId: 'moraleDecayPct', value: 20 },
    ],
  },
]

export function getEquipmentSetDef(id: string): EquipmentSetDefinition {
  const def = EQUIPMENT_SET_DEFS.find((s) => s.id === id)
  if (!def) throw new Error(`Unknown equipment set id: ${id}`)
  return def
}

/** Display metadata per effect id, for naming set bonuses in the UI (affix tooltips carry their own per-affix labels). */
const EFFECT_DISPLAY: Record<EquipmentEffectId, { label: string; sign: '+' | '-'; unit: '' | '%' }> = {
  combatPowerFlat: { label: 'CP', sign: '+', unit: '' },
  combatPowerPct: { label: 'equipment CP', sign: '+', unit: '%' },
  maxHpPct: { label: 'max HP', sign: '+', unit: '%' },
  cultivationRatePct: { label: 'cultivation', sign: '+', unit: '%' },
  woundResistPct: { label: 'wound damage', sign: '-', unit: '%' },
  healthRegenPct: { label: 'recovery', sign: '+', unit: '%' },
  moraleDecayPct: { label: 'morale decay', sign: '-', unit: '%' },
}

/** "2pc: +5 CP" / "3pc: −10% wound damage" — one set bonus, for the disciple panel. */
export function describeSetBonus(bonus: EquipmentSetBonus): string {
  const d = EFFECT_DISPLAY[bonus.effectId]
  return `${bonus.count}pc: ${d.sign}${bonus.value}${d.unit} ${d.label}`
}
