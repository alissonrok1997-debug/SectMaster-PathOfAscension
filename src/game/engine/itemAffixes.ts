import type { DiscipleInstance, EquipmentEffectId, EquipmentSlotType, ItemAffix, ItemQuality } from '../types'
import { AFFIX_COUNT_BY_QUALITY, ITEM_AFFIX_DEFS, getAffixDef, type AffixDefinition } from '../data/itemAffixDefs'
import { EQUIPMENT_SET_DEFS, type EquipmentSetDefinition } from '../data/equipmentSetDefs'

/**
 * EQUIPMENT_DEPTH_PLAN §4 — affix rolling + the single aggregation entry point every effect consumer
 * calls. Rolls happen once at item creation (crafting.ts) and are frozen onto the instance; nothing here
 * re-derives them on load. Aggregation is purely additive (two +10% pieces → +20%, not ×1.21) so a
 * tooltip can be verified by hand and totals can't run away at high item counts.
 */

/** Rounds a rolled value; Masterwork clamps the low end of the range to its midpoint (§4 "upper half"). */
function rollAffixValue(def: AffixDefinition, upperHalf: boolean): number {
  const lo = upperHalf ? (def.min + def.max) / 2 : def.min
  return Math.round(lo + Math.random() * (def.max - lo))
}

/**
 * Rolls the 0–2 affixes for a freshly-created equipment instance of `slotType` at `quality` (§4). Count
 * is Quality-driven; affixes are drawn without replacement (no duplicates) from the pool restricted to
 * this slot type, weighted. Masterwork rolls each value in its upper half. Called from the same path that
 * rolls Quality, so world-event grants get affixes for free.
 */
export function rollAffixes(slotType: EquipmentSlotType, quality: ItemQuality): ItemAffix[] {
  const count = AFFIX_COUNT_BY_QUALITY[quality]
  if (count <= 0) return []

  const pool = ITEM_AFFIX_DEFS.filter((a) => a.slots.includes(slotType))
  const upperHalf = quality === 'Masterwork'
  const chosen: ItemAffix[] = []
  const remaining = [...pool]

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, a) => sum + a.weight, 0)
    let roll = Math.random() * totalWeight
    let pickIndex = remaining.length - 1
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight
      if (roll < 0) {
        pickIndex = j
        break
      }
    }
    const [picked] = remaining.splice(pickIndex, 1)
    chosen.push({ affixId: picked.id, value: rollAffixValue(picked, upperHalf) })
  }

  return chosen
}

/**
 * §4 — the single entry point for every affix-driven effect: sums the matching affix values across a
 * disciple's four equipped slots. Percentage effects are returned as summed percentage points (the
 * consumer applies `× (1 + total/100)` or `× (1 − total/100)`); flat effects as a summed flat amount.
 * (Set bonuses, §5, add one more term here.)
 */
export function getEquippedEffectTotal(disciple: Pick<DiscipleInstance, 'equipment'>, effectId: EquipmentEffectId): number {
  let total = 0
  for (const instance of Object.values(disciple.equipment)) {
    if (!instance?.affixes) continue
    for (const affix of instance.affixes) {
      if (getAffixDef(affix.affixId).effectId === effectId) total += affix.value
    }
  }
  // Set bonuses (§5) reuse the same effect union — one more summed term, no new consumer.
  for (const active of getActiveEquipmentSets(disciple)) {
    for (const bonus of active.def.bonuses) {
      if (bonus.effectId === effectId && active.equippedCount >= bonus.count) total += bonus.value
    }
  }
  return total
}

export interface ActiveEquipmentSet {
  def: EquipmentSetDefinition
  /** How many of the set's pieces this disciple currently has equipped. */
  equippedCount: number
}

/**
 * §5 — every set with at least 2 of its pieces equipped on this disciple (2 is the lowest bonus tier, so
 * a single piece activates nothing). Membership is derived purely from equipped item def ids; there is no
 * stored set state. Drives both getEquippedEffectTotal's set term and the disciple-panel set display.
 */
export function getActiveEquipmentSets(disciple: Pick<DiscipleInstance, 'equipment'>): ActiveEquipmentSet[] {
  const equippedIds = Object.values(disciple.equipment)
    .filter((i): i is NonNullable<typeof i> => i !== undefined)
    .map((i) => i.itemId)
  const active: ActiveEquipmentSet[] = []
  for (const def of EQUIPMENT_SET_DEFS) {
    const equippedCount = def.pieces.filter((piece) => equippedIds.includes(piece)).length
    if (equippedCount >= 2) active.push({ def, equippedCount })
  }
  return active
}
