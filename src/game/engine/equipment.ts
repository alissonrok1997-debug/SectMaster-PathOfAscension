import type { DiscipleInstance, EquipmentSlotId, GameState } from '../types'
import { getItemDef } from '../data/itemDefs'
import { getEquipmentCombatPower } from './itemQuality'

/** doc 07 §4 — the two interchangeable accessory slots. */
export const ACCESSORY_SLOTS: EquipmentSlotId[] = ['accessory1', 'accessory2']

export const EQUIPMENT_SLOTS: EquipmentSlotId[] = ['weapon', 'bodyArmor', 'accessory1', 'accessory2']

const DEDICATED_SLOT: Record<'Weapon' | 'Armor', EquipmentSlotId> = {
  Weapon: 'weapon',
  Armor: 'bodyArmor',
}

/** Sums each equipped item's Combat Power bonus (doc 06 §2's "Equipped weapon, armor, and accessories" CP input), scaled by each piece's Quality (doc 07 §7). */
export function getDiscipleEquipmentCombatPower(disciple: DiscipleInstance): number {
  return EQUIPMENT_SLOTS.reduce((sum, slot) => {
    const instance = disciple.equipment[slot]
    if (instance === undefined) return sum
    return sum + getEquipmentCombatPower(instance.itemId, instance.quality)
  }, 0)
}

export interface EquipEligibility {
  canEquip: boolean
  reason?: string
  targetSlot?: EquipmentSlotId
}

/** Single source of truth for whether a specific equipment instance can be equipped, and which slot it lands in — shared by the Disciple Card UI and the store guard. Keyed by instance id, since two same-def pieces can differ in Quality. */
export function getEquipEligibility(state: GameState, discipleId: string, instanceId: string): EquipEligibility {
  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple) return { canEquip: false, reason: 'Disciple not found.' }

  const instance = state.items.find((i) => i.id === instanceId)
  if (!instance || instance.quantity <= 0) return { canEquip: false, reason: 'Not in inventory.' }

  const def = getItemDef(instance.itemId)
  if (def.category !== 'Equipment' || !def.slotType) return { canEquip: false, reason: 'Not equippable.' }

  if (def.slotType === 'Accessory') {
    const openSlot = ACCESSORY_SLOTS.find((slot) => disciple.equipment[slot] === undefined)
    if (!openSlot) return { canEquip: false, reason: 'Both accessory slots are full — unequip one first.' }
    return { canEquip: true, targetSlot: openSlot }
  }

  return { canEquip: true, targetSlot: DEDICATED_SLOT[def.slotType] }
}
