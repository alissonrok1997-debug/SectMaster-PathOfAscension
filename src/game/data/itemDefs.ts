import type { EquipmentSlotType, ItemCategory, ItemRarity } from '../types'

export interface ItemDefinition {
  id: string
  category: ItemCategory
  name: string
  description: string
  rarity: ItemRarity
  /** Equipment only. */
  slotType?: EquipmentSlotType
  /** Equipment only — base Combat Power added while equipped (doc 06 §2's "Equipped weapon, armor, and accessories" CP input). Scaled per instance by Quality (doc 07 §7, see engine/itemQuality.ts). Affinity/Upgrade-evolution (doc 07 §5-6) are still deferred. */
  combatPowerBonus?: number
  /** Pill only. */
  pillEffect?: 'heal' | 'cultivate'
  /** Pill only, 'cultivate' effect — flat cultivation progress points granted. */
  cultivateAmount?: number
  /** Pill only, 'heal' effect — flat HP restored (HEALTH_SYSTEM_PLAN Phase 3), clamped to max HP. */
  healAmount?: number
}

/**
 * MVP item pool (doc 07 §16: Resource/Equipment/Pill/Manual categories,
 * basic rarity). "Resource" category items aren't separately modeled here —
 * the 6 core resources have been a scalar `Resources` bucket since Wave 0/1
 * for tick-loop simplicity, and that already satisfies doc 07 §2 Category
 * 1's role. Artifacts/Mission Items/Quest Items exist in `ItemCategory` but
 * are out of MVP scope per doc 07 §16.
 *
 * Quality (doc 07 §7) is implemented as a per-instance roll on ItemInstance
 * (see engine/itemQuality.ts + data/itemQualityDefs.ts) — the `combatPowerBonus`
 * here is the *base*, scaled by the equipped instance's quality tier. Affinity
 * and Upgrade-evolution (doc 07 §5-6) remain deferred — not faked with systems
 * that don't exist yet.
 */
export const ITEM_DEFS: ItemDefinition[] = [
  {
    id: 'ironSword',
    category: 'Equipment',
    name: 'Iron Sword',
    description: 'A dependable forged blade.',
    rarity: 'Common',
    slotType: 'Weapon',
    combatPowerBonus: 8,
  },
  {
    id: 'spiritIronSword',
    category: 'Equipment',
    name: 'Spirit Iron Sword',
    description: 'Forged with Qi-infused iron — sharper and far more resilient than plain steel.',
    rarity: 'Uncommon',
    slotType: 'Weapon',
    combatPowerBonus: 16,
  },
  {
    id: 'clothRobe',
    category: 'Equipment',
    name: 'Cloth Robe',
    description: 'Simple protective robes.',
    rarity: 'Common',
    slotType: 'Armor',
    combatPowerBonus: 5,
  },
  {
    id: 'leatherVest',
    category: 'Equipment',
    name: 'Leather Vest',
    description: 'Reinforced leather armor, sturdier than plain cloth.',
    rarity: 'Uncommon',
    slotType: 'Armor',
    combatPowerBonus: 10,
  },
  {
    id: 'jadeRing',
    category: 'Equipment',
    name: 'Jade Ring',
    description: 'A modest jade band that steadies the wearer’s Qi.',
    rarity: 'Common',
    slotType: 'Accessory',
    combatPowerBonus: 3,
  },
  {
    id: 'talismanOfVigor',
    category: 'Equipment',
    name: 'Talisman of Vigor',
    description: 'An inked talisman that sharpens focus in a fight.',
    rarity: 'Uncommon',
    slotType: 'Accessory',
    combatPowerBonus: 6,
  },
  {
    id: 'minorHealingPill',
    category: 'Pill',
    name: 'Minor Healing Pill',
    description: 'Restores 40 HP. Consumed on use.',
    rarity: 'Common',
    pillEffect: 'heal',
    healAmount: 40,
  },
  {
    id: 'qiReplenishmentPill',
    category: 'Pill',
    name: 'Qi Replenishment Pill',
    description: 'Instantly grants cultivation progress. Consumed on use.',
    rarity: 'Common',
    pillEffect: 'cultivate',
    cultivateAmount: 15,
  },
  {
    id: 'swordManual',
    category: 'Manual',
    name: 'Sword Manual',
    description: 'A technique manual for the sword. Teach it to a disciple once the Sword Technique has been researched at the Research Institute — consumed when the disciple learns it.',
    rarity: 'Rare',
  },
]

export function getItemDef(id: string): ItemDefinition {
  const def = ITEM_DEFS.find((i) => i.id === id)
  if (!def) throw new Error(`Unknown item id: ${id}`)
  return def
}
