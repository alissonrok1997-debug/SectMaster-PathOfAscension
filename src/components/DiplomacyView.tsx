import { useGameStore } from '../game/state/store'
import { FACTION_DEFS } from '../game/data/factionDefs'
import { DIPLOMATIC_ACTION_DEFS } from '../game/data/diplomaticActionDefs'
import { getWorldEventDef } from '../game/data/worldEventDefs'
import { getRelationshipTier, getReputationTier } from '../game/engine/factions'
import { getDiplomaticActionEligibility } from '../game/engine/diplomacy'
import { formatCountdown } from '../game/utils/formatDuration'
import { formatResourceCost } from '../game/utils/formatResources'

/**
 * The diplomacy sub-view of the World tab (WORLD_MAP_DESIGN §12.1). Was `WorldPanel`;
 * the Territories section it used to carry is gone in Phase 5A — territories are now
 * location outposts claimed on the map — leaving reputation, factions/diplomacy, and
 * the active world event here.
 */
export function DiplomacyView() {
  // Subscribing to the whole state so relationship/reputation/countdowns re-render every tick.
  const state = useGameStore((s) => s.state)
  const performDiplomaticAction = useGameStore((s) => s.performDiplomaticAction)

  const activeWorldEventDef = state.worldEvent ? getWorldEventDef(state.worldEvent.defId) : undefined

  return (
    <section className="panel world-panel">
      <h2>World &amp; Diplomacy</h2>
      <p className="panel-hint">
        Reputation: <strong>{Math.round(state.reputation)}</strong> ({getReputationTier(state.reputation)})
      </p>

      {activeWorldEventDef && state.worldEvent && (
        <div className="crafting-in-progress">
          <div className="progress-bar">
            <div
              className="progress-bar-fill night"
              style={{
                width: `${Math.min(
                  100,
                  100 - ((state.worldEvent.endsAt - Date.now()) / activeWorldEventDef.durationMs) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="panel-hint">
            <strong>{activeWorldEventDef.name}</strong> &mdash; {activeWorldEventDef.text} &middot;{' '}
            {formatCountdown(state.worldEvent.endsAt - Date.now())} remaining
          </p>
        </div>
      )}

      <h3 className="doctrine-section-title">Factions</h3>
      <p className="panel-hint">
        Alliance and Non-Aggression Pact aren't available yet — their benefits need a conflict system
        that arrives later, so relationship gains from the actions below cap just below Trusted Ally.
      </p>
      <div className="recipe-grid">
        {FACTION_DEFS.map((faction) => {
          const relationship = state.factionRelationships[faction.id] ?? 0
          return (
            <div className="recipe-card" key={faction.id}>
              <div className="recipe-card-header">
                <h3>{faction.name}</h3>
                <span className="recipe-discipline">{faction.category}</span>
              </div>
              <p className="panel-hint">{faction.description}</p>
              <p className="recipe-meta status-badge">
                Relationship: {Math.round(relationship)} ({getRelationshipTier(relationship)})
              </p>
              <div className="diplomatic-action-list">
                {DIPLOMATIC_ACTION_DEFS.map((action) => {
                  const eligibility = getDiplomaticActionEligibility(state, faction.id, action.id)
                  return (
                    <div className="diplomatic-action-row" key={action.id}>
                      <button
                        disabled={!eligibility.canPerform}
                        onClick={() => performDiplomaticAction(faction.id, action.id)}
                        title={action.description}
                      >
                        {action.name}
                        {Object.keys(eligibility.cost).length > 0 ? ` (${formatResourceCost(eligibility.cost)})` : ''}
                      </button>
                      {!eligibility.canPerform && eligibility.reason && (
                        <p className="upgrade-blocked-reason">{eligibility.reason}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
