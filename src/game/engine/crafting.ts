import type { GameState, ItemCategory, ItemInstance, ItemQuality, Resources } from '../types'
import { getRecipe } from '../data/craftingRecipes'
import { getBuildingDef } from '../data/buildingDefs'
import { getItemDef } from '../data/itemDefs'
import { RESOURCE_LABELS } from '../data/resourceLabels'
import { rollItemQuality } from './itemQuality'

export interface CraftEligibility {
  canCraft: boolean
  reason?: string
}

/** Single source of truth for whether a recipe can be started — shared by the Crafting Panel and the store guard, same pattern as getUpgradeEligibility. */
export function getCraftEligibility(state: GameState, recipeId: string): CraftEligibility {
  const recipe = getRecipe(recipeId)

  if (state.craftingQueue !== undefined) {
    return { canCraft: false, reason: 'Crafting queue is busy — only one item can be crafted at a time.' }
  }
  if (!state.buildings[recipe.requiredBuildingId]) {
    return { canCraft: false, reason: `Requires the ${getBuildingDef(recipe.requiredBuildingId).name} to be built.` }
  }
  const deficits = (Object.entries(recipe.cost) as [keyof Resources, number][])
    .filter(([key, amount]) => state.resources[key] < amount)
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
  if (deficits.length > 0) {
    return { canCraft: false, reason: `Need ${deficits.join(', ')}.` }
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

/** Appends a brand-new unique equipment instance with a rolled Quality (doc 07 §7). Equipment never stacks — two same-def pieces can differ in quality. */
export function addEquipmentInstance(items: ItemInstance[], itemDefId: string, quality: ItemQuality): ItemInstance[] {
  return [...items, { id: crypto.randomUUID(), category: 'Equipment', itemId: itemDefId, quantity: 1, quality }]
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
 * Resolves an in-progress craft once its timer elapses, granting one unit
 * of the recipe's item. Single-slot sweep — same "sweep whatever's due"
 * shape as resolveCompletedConstruction/resolveCompletedMissions, callable
 * from both the live tick and the offline catch-up loop.
 */
export function resolveCompletedCrafting(
  state: GameState,
  now: number,
): { state: GameState; itemCrafted?: string; craftedQuality?: ItemQuality } {
  const queue = state.craftingQueue
  if (queue === undefined || queue.endsAt > now) return { state }

  const recipe = getRecipe(queue.recipeId)
  const itemDef = getItemDef(recipe.itemDefId)
  const quality = itemDef.category === 'Equipment' ? rollItemQuality() : undefined
  const items =
    quality !== undefined
      ? addEquipmentInstance(state.items, recipe.itemDefId, quality)
      : addStackableItem(state.items, recipe.itemDefId, itemDef.category)

  return {
    state: { ...state, items, craftingQueue: undefined },
    itemCrafted: recipe.itemDefId,
    craftedQuality: quality,
  }
}
