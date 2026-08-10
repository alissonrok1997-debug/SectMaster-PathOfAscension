import type { CultivationRealm, EquipmentSlotType, ItemCategory, ItemRarity } from '../types'

export interface ItemDefinition {
  id: string
  category: ItemCategory
  name: string
  description: string
  rarity: ItemRarity
  /** Equipment only. */
  slotType?: EquipmentSlotType
  /** Equipment only (EQUIPMENT_DEPTH_PLAN §3) — cultivation realm required to equip. Absent = wearable by anyone. Enforced in engine/equipment.ts getEquipEligibility. */
  realmRequirement?: CultivationRealm
  /** Equipment only (EQUIPMENT_DEPTH_PLAN §5) — the equipment set this piece belongs to (data/equipmentSetDefs.ts). Set bonuses are derived from equipped membership; there is no persisted set field. */
  setId?: string
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
    setId: 'ironSentinel',
    combatPowerBonus: 8,
  },
  {
    id: 'spiritIronSword',
    category: 'Equipment',
    name: 'Spirit Iron Sword',
    description: 'Forged with Qi-infused iron — sharper and far more resilient than plain steel.',
    rarity: 'Uncommon',
    slotType: 'Weapon',
    realmRequirement: 'Qi Condensation',
    combatPowerBonus: 16,
  },
  {
    id: 'clothRobe',
    category: 'Equipment',
    name: 'Cloth Robe',
    description: 'Simple protective robes.',
    rarity: 'Common',
    slotType: 'Armor',
    setId: 'verdantScholar',
    combatPowerBonus: 5,
  },
  {
    id: 'leatherVest',
    category: 'Equipment',
    name: 'Leather Vest',
    description: 'Reinforced leather armor, sturdier than plain cloth.',
    rarity: 'Uncommon',
    slotType: 'Armor',
    realmRequirement: 'Qi Condensation',
    setId: 'ironSentinel',
    combatPowerBonus: 10,
  },
  {
    id: 'jadeRing',
    category: 'Equipment',
    name: 'Jade Ring',
    description: 'A modest jade band that steadies the wearer’s Qi.',
    rarity: 'Common',
    slotType: 'Accessory',
    setId: 'ironSentinel',
    combatPowerBonus: 3,
  },
  {
    id: 'talismanOfVigor',
    category: 'Equipment',
    name: 'Talisman of Vigor',
    description: 'An inked talisman that sharpens focus in a fight.',
    rarity: 'Uncommon',
    slotType: 'Accessory',
    realmRequirement: 'Qi Condensation',
    setId: 'verdantScholar',
    combatPowerBonus: 6,
  },
  {
    id: 'jadePendant',
    category: 'Equipment',
    name: 'Jade Pendant',
    description: 'A cool teardrop of unworked jade worn against the sternum. It asks nothing of a fighter and everything of a cultivator.',
    rarity: 'Common',
    slotType: 'Accessory',
    setId: 'verdantScholar',
    combatPowerBonus: 4,
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

  // --- Crafting Recipe Pack, Phase 1: pure-data equipment & pills (CRAFTING_RECIPE_PACK.md §3-6) ---
  // Weapons (Forging)
  {
    id: 'cloudpiercerSpear',
    category: 'Equipment',
    name: 'Cloudpiercer Spear',
    description: 'A spear shaft of seasoned spirit wood, tipped for reach. Its wielder strikes before the enemy has finished stepping forward.',
    rarity: 'Rare',
    slotType: 'Weapon',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 30,
  },
  {
    id: 'nineRingSaber',
    category: 'Equipment',
    name: 'Nine-Ring Saber',
    description: 'Nine loose rings ride the spine of this heavy dao. They ring on every swing, and the sound alone has broken lesser cultivators.',
    rarity: 'Rare',
    slotType: 'Weapon',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 30,
  },
  // Armor (Forging)
  {
    id: 'scaledSpiritMail',
    category: 'Equipment',
    name: 'Scaled Spirit Mail',
    description: 'Overlapping iron scales lacquered against rust. Heavy, honest, and it has kept more disciples alive than any technique.',
    rarity: 'Rare',
    slotType: 'Armor',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 19,
  },
  {
    id: 'cloudweaveRobe',
    category: 'Equipment',
    name: 'Cloudweave Robe',
    description: 'Woven so fine it drifts when the wearer stops moving. Offers less than mail and never slows a step.',
    rarity: 'Rare',
    slotType: 'Armor',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 17,
  },
  // Accessories (Alchemy)
  {
    id: 'spiritGatheringPendant',
    category: 'Equipment',
    name: 'Spirit-Gathering Pendant',
    description: 'A hollow jade drop that draws ambient Qi inward the way a low place gathers water.',
    rarity: 'Rare',
    slotType: 'Accessory',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 12,
  },
  {
    id: 'cinnabarWardTalisman',
    category: 'Equipment',
    name: 'Cinnabar Ward Talisman',
    description: 'Inked in cinnabar on the night of a new moon. The strokes have to be right the first time; there is no correcting them.',
    rarity: 'Rare',
    slotType: 'Accessory',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 13,
  },
  // Pills — healing line (hard ceiling 100 HP)
  {
    id: 'swiftMendingPowder',
    category: 'Pill',
    name: 'Swift Mending Powder',
    description: 'Ground herb, taken with water. Crude, cheap, and enough to get a disciple back on their feet. Restores 25 HP. Consumed on use.',
    rarity: 'Common',
    pillEffect: 'heal',
    healAmount: 25,
  },
  {
    id: 'jadeDewPill',
    category: 'Pill',
    name: 'Jade Dew Pill',
    description: 'Condensed from dew gathered off spirit jade at dawn. One dose closes any wound the body can still close. Restores 100 HP. Consumed on use.',
    rarity: 'Uncommon',
    pillEffect: 'heal',
    healAmount: 100,
  },
  // Pills — cultivation line (hard ceiling 100 progress)
  {
    id: 'spiritConvergencePill',
    category: 'Pill',
    name: 'Spirit Convergence Pill',
    description: 'Draws scattered Qi into a single thread and feeds it inward. Grants cultivation progress. Consumed on use.',
    rarity: 'Uncommon',
    pillEffect: 'cultivate',
    cultivateAmount: 35,
  },
  {
    id: 'marrowCleansingPill',
    category: 'Pill',
    name: 'Marrow-Cleansing Pill',
    description: 'Bitter beyond describing. It scours impurity out of the bone, and the night after is not pleasant. Grants cultivation progress. Consumed on use.',
    rarity: 'Rare',
    pillEffect: 'cultivate',
    cultivateAmount: 70,
  },

  // --- Crafting Recipe Pack, Phase 2: manuals (CRAFTING_RECIPE_PACK.md §7) ---
  // Each manual is inert alone — it pairs with a technique (techniqueDefs.ts) and an
  // unlockTechnique research (researchProjectDefs.ts), mirroring the swordManual triple.
  {
    id: 'saberManual',
    category: 'Manual',
    name: 'Saber Manual',
    description: 'Field notes from a wandering saber-master, copied fair. Direct, unsubtle, effective. Teach it to a disciple once Saber Form Compilation has been researched — consumed when the disciple learns it.',
    rarity: 'Rare',
  },
  {
    id: 'spearManual',
    category: 'Manual',
    name: 'Spear Manual',
    description: 'The coiling dragon form, diagrammed across forty leaves. The footwork takes longer to learn than the thrusts. Teach it to a disciple once the Spear Doctrine of the Coiling Dragon has been researched — consumed when the disciple learns it.',
    rarity: 'Rare',
  },
  {
    id: 'ironPalmManual',
    category: 'Manual',
    name: 'Iron Palm Manual',
    description: 'A conditioning regimen as much as a technique. The first chapter is entirely about what the hands will go through. Teach it to a disciple once the Vajra Palm Treatises have been researched — consumed when the disciple learns it.',
    rarity: 'Rare',
  },
  {
    id: 'bodyTemperingManual',
    category: 'Manual',
    name: 'Body Tempering Manual',
    description: 'The Golden Bell doctrine, complete. It asks years of the body and gives back a body worth the years. Teach it to a disciple once the Golden Bell Body Doctrine has been researched — consumed when the disciple learns it.',
    rarity: 'Epic',
  },

  // --- Crafting Recipe Pack, Phase 3: material-gated items (CRAFTING_RECIPE_PACK.md §3-7) ---
  // Weapons (Forging)
  {
    id: 'frostveinJian',
    category: 'Equipment',
    name: 'Frostvein Jian',
    description: 'Ore drawn from a frozen spirit vein, folded while still cold. The blade never warms, even in the hand.',
    rarity: 'Rare',
    slotType: 'Weapon',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 33,
  },
  {
    id: 'thunderchaseBlade',
    category: 'Equipment',
    name: 'Thunderchase Blade',
    description: 'Quenched during a storm in wood the heavens had already struck. It answers lightning with lightning.',
    rarity: 'Epic',
    slotType: 'Weapon',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 55,
  },
  {
    id: 'coilingSerpentWhip',
    category: 'Equipment',
    name: 'Coiling Serpent Whip',
    description: 'A soft whip of braided serpent sinew that strikes around a guard rather than through it.',
    rarity: 'Epic',
    slotType: 'Weapon',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 52,
  },
  {
    id: 'duskfallGuandao',
    category: 'Equipment',
    name: 'Duskfall Guandao',
    description: 'A great pole-blade of meteoric iron, too heavy for most and decisive for the rest.',
    rarity: 'Epic',
    slotType: 'Weapon',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 58,
  },
  {
    id: 'ninefoldAscensionSword',
    category: 'Equipment',
    name: 'Ninefold Ascension Sword',
    description: 'Folded nine times over nine days, each fold sealed with condensed starlight. A sword meant to be inherited, not bought.',
    rarity: 'Legendary',
    slotType: 'Weapon',
    realmRequirement: 'Nascent Soul',
    combatPowerBonus: 95,
  },
  // Armor (Forging)
  {
    id: 'stoneheartCuirass',
    category: 'Equipment',
    name: 'Stoneheart Cuirass',
    description: 'A plate cored with jade drawn from deep earth. The wearer stands where they choose to stand.',
    rarity: 'Rare',
    slotType: 'Armor',
    realmRequirement: 'Foundation Establishment',
    combatPowerBonus: 21,
  },
  {
    id: 'goldenBellVestment',
    category: 'Equipment',
    name: 'Golden Bell Vestment',
    description: 'Stitched to the old Golden Bell principle: the body ringed in force, the blow turned aside before it lands.',
    rarity: 'Epic',
    slotType: 'Armor',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 35,
  },
  {
    id: 'frostveilMantle',
    category: 'Equipment',
    name: 'Frostveil Mantle',
    description: 'Cold hangs about the shoulders of whoever wears it. Enemies mistake the stillness for hesitation.',
    rarity: 'Epic',
    slotType: 'Armor',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 33,
  },
  {
    id: 'nineHeavensFeatherRaiment',
    category: 'Equipment',
    name: 'Nine Heavens Feather Raiment',
    description: 'Silk and phoenix plume, layered until it weighs nothing at all. Worn by those a sect intends to be remembered for.',
    rarity: 'Legendary',
    slotType: 'Armor',
    realmRequirement: 'Nascent Soul',
    combatPowerBonus: 60,
  },
  // Accessories (Alchemy)
  {
    id: 'eyeOfTheStillLake',
    category: 'Equipment',
    name: 'Eye of the Still Lake',
    description: 'A lens of moonwell water held in silver, forever unrippled. Those who wear it are hard to startle.',
    rarity: 'Epic',
    slotType: 'Accessory',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 22,
  },
  {
    id: 'ancestralJadeSeal',
    category: 'Equipment',
    name: 'Ancestral Jade Seal',
    description: "Carved with a sect's mark and warmed by generations of hands. It is worn as a claim, not an ornament.",
    rarity: 'Epic',
    slotType: 'Accessory',
    realmRequirement: 'Core Formation',
    combatPowerBonus: 24,
  },
  {
    id: 'heartOfTheSleepingDragon',
    category: 'Equipment',
    name: 'Heart of the Sleeping Dragon',
    description: 'Heartblood that never cooled, sealed in ancestral jade. It beats — slowly, and not in time with the wearer.',
    rarity: 'Legendary',
    slotType: 'Accessory',
    realmRequirement: 'Nascent Soul',
    combatPowerBonus: 38,
  },
  // Pill (Alchemy) — cultivation line capstone, 100 = one small realm from zero (hard ceiling)
  {
    id: 'foundationEstablishmentPill',
    category: 'Pill',
    name: 'Foundation Establishment Pill',
    description: 'The pill every outer disciple hears about and few ever hold. Taken correctly, it carries the body a full stage forward. Grants cultivation progress. Consumed on use.',
    rarity: 'Epic',
    pillEffect: 'cultivate',
    cultivateAmount: 100,
  },
  // Manual (Alchemy) — pairs with flyingSwordControl technique + martialArtsFlyingSword research
  {
    id: 'flyingSwordManual',
    category: 'Manual',
    name: 'Flying Sword Manual',
    description: 'Written in starfall ink because ordinary ink will not hold the diagrams. A sword that leaves the hand and still obeys. Teach it to a disciple once Flying Sword Sublimation has been researched — consumed when the disciple learns it.',
    rarity: 'Legendary',
  },
]

export function getItemDef(id: string): ItemDefinition {
  const def = ITEM_DEFS.find((i) => i.id === id)
  if (!def) throw new Error(`Unknown item id: ${id}`)
  return def
}
