import { useState } from 'react'
import type { Resources } from '../game/types'
import { useGameStore } from '../game/state/store'
import { CRAFTING_RECIPES, type CraftingRecipe } from '../game/data/craftingRecipes'
import { getItemDef } from '../game/data/itemDefs'
import { getMaterialDef } from '../game/data/materialDefs'
import { getCraftEligibility } from '../game/engine/crafting'
import { getResearchCraftingDurationMultiplier } from '../game/engine/research'
import { formatCountdown } from '../game/utils/formatDuration'
import { formatResourceCost } from '../game/utils/formatResources'

/** Multiplies every resource amount in a cost by `mult` — for showing a batch's total price. */
function scaleCost(cost: Partial<Resources>, mult: number): Partial<Resources> {
  const scaled: Partial<Resources> = {}
  for (const [key, amount] of Object.entries(cost) as [keyof Resources, number][]) scaled[key] = amount * mult
  return scaled
}

/** "12 Frostvein Ore, 20 Skyfall Iron" — the crafting-material half of a recipe's price (§8), scaled by batch. */
function formatMaterialCost(materialCost: Record<string, number> | undefined, mult: number): string {
  if (!materialCost) return ''
  return Object.entries(materialCost)
    .map(([key, amount]) => `${amount * mult} ${getMaterialDef(key).name}`)
    .join(', ')
}

/** One recipe row with its own batch-quantity stepper. Local state only — how many to craft is a UI choice, never game state. */
function RecipeCraftCard({ recipe }: { recipe: CraftingRecipe }) {
  const state = useGameStore((s) => s.state)
  const startCraft = useGameStore((s) => s.startCraft)
  const [quantity, setQuantity] = useState(1)

  const def = getItemDef(recipe.itemDefId)
  const eligibility = getCraftEligibility(state, recipe.id, quantity)
  const durationMs = recipe.durationMs * getResearchCraftingDurationMultiplier(state, recipe.discipline)

  return (
    <div className="recipe-card">
      <div className="recipe-card-header">
        <h3>{def.name}</h3>
        <span className="recipe-discipline">{recipe.discipline}</span>
      </div>
      <p className="panel-hint">{def.description}</p>
      <p className="recipe-meta">
        {def.rarity} &middot; {formatResourceCost(recipe.cost)}
        {recipe.materialCost ? `, ${formatMaterialCost(recipe.materialCost, 1)}` : ''} each &middot;{' '}
        {Math.round(durationMs / 1000)}s each
      </p>
      {def.realmRequirement && (
        <p className="recipe-meta">Requires {def.realmRequirement} to equip</p>
      )}

      <div className="dispatch-cycle-stepper">
        <span>Amount:</span>
        <button disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
          −
        </button>
        <strong>{quantity}</strong>
        <button onClick={() => setQuantity(quantity + 1)}>+</button>
      </div>
      {quantity > 1 && (
        <p className="recipe-meta">
          Total: {formatResourceCost(scaleCost(recipe.cost, quantity))}
          {recipe.materialCost ? `, ${formatMaterialCost(recipe.materialCost, quantity)}` : ''} &middot;{' '}
          {Math.round((durationMs * quantity) / 1000)}s
        </p>
      )}

      <button disabled={!eligibility.canCraft} onClick={() => startCraft(recipe.id, quantity)}>
        Craft{quantity > 1 ? ` ×${quantity}` : ''}
      </button>
      {!eligibility.canCraft && eligibility.reason && (
        <p className="upgrade-blocked-reason">{eligibility.reason}</p>
      )}
    </div>
  )
}

export function CraftingPanel() {
  // Subscribing to the whole state so the in-progress craft's countdown re-renders every tick.
  const state = useGameStore((s) => s.state)

  const queue = state.craftingQueue
  const queuedRecipe = queue ? CRAFTING_RECIPES.find((r) => r.id === queue.recipeId) : undefined
  const itemDurationMs =
    queue?.itemDurationMs ??
    (queuedRecipe ? queuedRecipe.durationMs * getResearchCraftingDurationMultiplier(state, queuedRecipe.discipline) : 0)
  const remaining = queue?.remaining ?? 1

  return (
    <section className="panel crafting-panel">
      <h2>Crafting</h2>
      <p className="panel-hint">
        Forge weapons and armor at the Forge; brew pills and craft accessories/manuals at the Alchemy Workshop.
        Single crafting queue — one item at a time, sect-wide. Pick an amount to queue a batch (paid upfront).
      </p>

      {queue && queuedRecipe && (
        <div className="crafting-in-progress">
          <div className="progress-bar">
            <div
              className="progress-bar-fill day"
              style={{
                width: `${Math.min(100, 100 - ((queue.endsAt - Date.now()) / itemDurationMs) * 100)}%`,
              }}
            />
          </div>
          <p className="panel-hint">
            Crafting {getItemDef(queuedRecipe.itemDefId).name} &middot;{' '}
            {formatCountdown(queue.endsAt - Date.now())} remaining
            {remaining > 1 ? ` · ${remaining} left in batch` : ''}
          </p>
        </div>
      )}

      <div className="recipe-grid">
        {CRAFTING_RECIPES.map((recipe) => (
          <RecipeCraftCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </section>
  )
}
