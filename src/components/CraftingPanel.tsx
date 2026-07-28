import { useGameStore } from '../game/state/store'
import { CRAFTING_RECIPES } from '../game/data/craftingRecipes'
import { getItemDef } from '../game/data/itemDefs'
import { getCraftEligibility } from '../game/engine/crafting'
import { getResearchCraftingDurationMultiplier } from '../game/engine/research'
import { formatCountdown } from '../game/utils/formatDuration'
import { formatResourceCost } from '../game/utils/formatResources'

export function CraftingPanel() {
  // Subscribing to the whole state so the in-progress craft's countdown re-renders every tick.
  const state = useGameStore((s) => s.state)
  const startCraft = useGameStore((s) => s.startCraft)

  const queue = state.craftingQueue
  const queuedRecipe = queue ? CRAFTING_RECIPES.find((r) => r.id === queue.recipeId) : undefined
  const queuedDurationMs = queuedRecipe
    ? queuedRecipe.durationMs * getResearchCraftingDurationMultiplier(state, queuedRecipe.discipline)
    : 0

  return (
    <section className="panel crafting-panel">
      <h2>Crafting</h2>
      <p className="panel-hint">
        Forge weapons and armor at the Forge; brew pills and craft accessories/manuals at the Alchemy Workshop.
        Single crafting queue — only one item at a time, sect-wide.
      </p>

      {queue && queuedRecipe && (
        <div className="crafting-in-progress">
          <div className="progress-bar">
            <div
              className="progress-bar-fill day"
              style={{
                width: `${Math.min(100, 100 - ((queue.endsAt - Date.now()) / queuedDurationMs) * 100)}%`,
              }}
            />
          </div>
          <p className="panel-hint">
            Crafting {getItemDef(queuedRecipe.itemDefId).name} &middot;{' '}
            {formatCountdown(queue.endsAt - Date.now())} remaining
          </p>
        </div>
      )}

      <div className="recipe-grid">
        {CRAFTING_RECIPES.map((recipe) => {
          const def = getItemDef(recipe.itemDefId)
          const eligibility = getCraftEligibility(state, recipe.id)
          const durationMs = recipe.durationMs * getResearchCraftingDurationMultiplier(state, recipe.discipline)
          return (
            <div className="recipe-card" key={recipe.id}>
              <div className="recipe-card-header">
                <h3>{def.name}</h3>
                <span className="recipe-discipline">{recipe.discipline}</span>
              </div>
              <p className="panel-hint">{def.description}</p>
              <p className="recipe-meta">
                {def.rarity} &middot; {formatResourceCost(recipe.cost)} &middot; {Math.round(durationMs / 1000)}s
              </p>
              <button disabled={!eligibility.canCraft} onClick={() => startCraft(recipe.id)}>
                Craft
              </button>
              {!eligibility.canCraft && eligibility.reason && (
                <p className="upgrade-blocked-reason">{eligibility.reason}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
