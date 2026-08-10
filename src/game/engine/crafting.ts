import type { GameState, ItemCategory, ItemInstance, ItemQuality, Resources } from '../types'
import { getRecipe } from '../data/craftingRecipes'
import { getBuildingDef } from '../data/buildingDefs'
import { getItemDef } from '../data/itemDefs'
import { getMaterialDef } from '../data/materialDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'
import { rollItemQuality } from './itemQuality'
import { rollAffixes } from './itemAffixes'
import { generateForgedName } from './itemProvenance'

export interface CraftEligibility {
  canCraft: boolean
  reason?: string
}

/**
 * Single source of truth for whether a recipe can be started — shared by the
 * Crafting Panel and the store guard, same pattern as getUpgradeEligibility. A
 * batch of `quantity` charges its whole cost upfront, so affordability is checked
 * against `cost × quantity`.
 */
export function getCraftEligibility(state: GameState, recipeId: string, quantity = 1): CraftEligibility {
  const recipe = getRecipe(recipeId)

  if (quantity < 1) {
    return { canCraft: false, reason: 'Choose at least one item to craft.' }
  }
  if (state.craftingQueue !== undefined) {
    return { canCraft: false, reason: 'Crafting queue is busy — only one item can be crafted at a time.' }
  }
  if (!state.buildings[recipe.requiredBuildingId]) {
    return { canCraft: false, reason: `Requires the ${getBuildingDef(recipe.requiredBuildingId).name} to be built.` }
  }
  const deficits = (Object.entries(recipe.cost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount * quantity)
    .map(([key, amount]) => `${amount * quantity} ${RESOURCE_LABELS[key]}`)
  const materialDeficits = Object.entries(recipe.materialCost ?? {})
    .filter(([key, amount]) => (state.materials[key] ?? 0) < amount * quantity)
    .map(([key, amount]) => `${amount * quantity} ${getMaterialDef(key).name}`)
  const allDeficits = [...deficits, ...materialDeficits]
  if (allDeficits.length > 0) {
    return { canCraft: false, reason: `Need ${allDeficits.join(', ')}.` }
  }

  return { canCraft: true }
}

/** Adds one unit of a stackable (non-equipment) item, creating a stack if none exists yet. */
export function addStackableItem(items: ItemInstance[], itemDefId: string, category: ItemCategory): ItemInstance[] {
  const existing = items.find((i) => i.itemId === itemDefId)
  if (existing) {
    return items.map((i) => (i.itemId === itemDefId ? { ...i, quantity: i.quantity + 1 } : i))
  }
  return [...items, { id: crypto.randomUUID(), category, itemId: itemDefId, quantity: 1 }]
}

/**
 * Appends a brand-new unique equipment instance with a rolled Quality (doc 07 §7), 0–2 Quality-driven
 * affixes (EQUIPMENT_DEPTH_PLAN §4), and provenance (§6): a forged name for Perfect/Masterwork rolls, the
 * forge date, and the crafter if one was captured at batch start. Equipment never stacks.
 */
export function addEquipmentInstance(
  items: ItemInstance[],
  itemDefId: string,
  quality: ItemQuality,
  opts: { craftedBy?: string } = {},
): ItemInstance[] {
  const slotType = getItemDef(itemDefId).slotType
  const affixes = slotType ? rollAffixes(slotType, quality) : []
  const instance: ItemInstance = { id: crypto.randomUUID(), category: 'Equipment', itemId: itemDefId, quantity: 1, quality, forgedOnDay: Date.now() }
  if (affixes.length > 0) instance.affixes = affixes
  if (opts.craftedBy) instance.craftedBy = opts.craftedBy
  if (slotType && (quality === 'Perfect' || quality === 'Masterwork')) instance.forgedName = generateForgedName(slotType)
  return [...items, instance]
}

/** Returns an already-existing instance to inventory unchanged (used when unequipping / swapping equipment out). */
export function addExistingInstance(items: ItemInstance[], instance: ItemInstance): ItemInstance[] {
  return [...items, instance]
}

/** Grants one freshly-obtained item, routing by category: equipment rolls a Quality and becomes a unique instance; everything else stacks. Shared by crafting resolution and world-event rewards. */
export function grantItemToInventory(items: ItemInstance[], itemDefId: string): ItemInstance[] {
  const def = getItemDef(itemDefId)
  if (def.category === 'Equipment') return addEquipmentInstance(items, itemDefId, rollItemQuality())
  return addStackableItem(items, itemDefId, def.category)
}

/** Removes a specific unique instance by id (used when equipping an equipment piece). */
export function removeInstanceById(items: ItemInstance[], instanceId: string): ItemInstance[] {
  return items.filter((i) => i.id !== instanceId)
}

/** Removes one unit of a stackable item from its stack, dropping the stack entirely once it hits 0. */
export function removeItemFromInventory(items: ItemInstance[], itemDefId: string): ItemInstance[] {
  return items.map((i) => (i.itemId === itemDefId ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0)
}

/**
 * Resolves an in-progress craft once its timer elapses. Drains every batch item
 * whose scheduled completion has already passed (so a fast recipe or a long
 * offline gap produces the right count in one call, not one-per-tick), granting a
 * fresh unit each time and chaining the next item's timer off the previous one.
 * Same "sweep whatever's due" shape as resolveCompletedConstruction, callable from
 * both the live tick and the offline catch-up loop.
 */
export function resolveCompletedCrafting(
  state: GameState,
  now: number,
): { state: GameState; craftedItems: { itemDefId: string; quality?: ItemQuality }[] } {
  const queue = state.craftingQueue
  if (queue === undefined || queue.endsAt > now) return { state, craftedItems: [] }

  const recipe = getRecipe(queue.recipeId)
  const itemDef = getItemDef(recipe.itemDefId)
  const itemDurationMs = queue.itemDurationMs ?? 0

  let items = state.items
  let remaining = queue.remaining ?? 1
  let endsAt = queue.endsAt
  const craftedItems: { itemDefId: string; quality?: ItemQuality }[] = []

  // Produce each item whose completion time has already elapsed. A non-positive
  // itemDurationMs (legacy single-item queues) can't schedule a successor, so the
  // loop naturally stops after one — matching the old single-item behaviour.
  while (remaining > 0 && endsAt <= now) {
    const quality = itemDef.category === 'Equipment' ? rollItemQuality() : undefined
    items =
      quality !== undefined
        ? addEquipmentInstance(items, recipe.itemDefId, quality, { craftedBy: queue.craftedBy })
        : addStackableItem(items, recipe.itemDefId, itemDef.category)
    craftedItems.push({ itemDefId: recipe.itemDefId, quality })
    remaining -= 1
    if (remaining > 0 && itemDurationMs > 0) endsAt += itemDurationMs
    else break
  }

  const craftingQueue =
    remaining > 0 ? { recipeId: queue.recipeId, endsAt, remaining, itemDurationMs } : undefined

  return { state: { ...state, items, craftingQueue }, craftedItems }
}
