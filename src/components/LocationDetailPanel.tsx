import type { NpcSect, Resources, SectId, SiteModifierBundle } from '../game/types'
import type { ResolvedLocation } from '../game/engine/world/worldQueries'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { getResourceArchetype } from '../game/data/world/resourceArchetypeDefs'
import { getExplorationArchetype } from '../game/data/world/explorationArchetypeDefs'
import { formatDurationAdaptive } from '../game/utils/formatDuration'

function formatYield(yieldPerVisit: Partial<Resources>): string {
  return (Object.entries(yieldPerVisit) as [keyof Resources, number][])
    .map(([key, amount]) => `${amount} ${RESOURCE_LABELS[key]}`)
    .join(', ')
}

/** Human-readable summary of an outpost bonus bundle (production multipliers). */
export function formatOutpostBonus(bonus: Partial<SiteModifierBundle>): string {
  const parts: string[] = []
  for (const [key, mult] of Object.entries(bonus.productionMultByResource ?? {}) as [keyof Resources, number][]) {
    parts.push(`${RESOURCE_LABELS[key]} +${Math.round((mult - 1) * 100)}%`)
  }
  return parts.join(', ')
}

/**
 * One location card (WORLD_MAP_DESIGN §12.3). Pure display: the round-trip travel
 * time is computed by travel.ts in the parent and passed in, never derived here
 * (§12.5). Resource sites dispatch a gather expedition; exploration sites are
 * shown but their expeditions arrive in a later phase, stated honestly rather
 * than faked.
 */
export function LocationDetailPanel({
  location,
  travelMs,
  ownerNpc,
  claimBlocked,
  onDispatch,
  onClaim,
  onRaid,
  onGarrison,
  onSurvey,
  sectId,
}: {
  location: ResolvedLocation
  travelMs: number
  /** The live NPC holding this node, if any (FIRST_REALM_PLAN §4.2) — undefined for neutral or player-held. */
  ownerNpc?: NpcSect
  /** Reason the Claim/Seize action is greyed out — outside influence, too little reputation, or unaffordable (§4.2/§4.6); undefined = claimable. */
  claimBlocked?: string
  onDispatch?: () => void
  onClaim?: () => void
  onRaid?: () => void
  onGarrison?: () => void
  onSurvey?: () => void
  /** The viewing sect's own id — ownership is relative to it, never to a literal (MULTIPLAYER_PLAN §7.1). */
  sectId: SectId
}) {
  const depleted = location.kind === 'resource' && location.runtime.remainingCapacity <= 0
  const upgradePath = location.kind === 'resource' ? location.upgradePath : undefined
  const hasOutpost = location.runtime.outpostLevel >= 1
  const ownerId = location.runtime.ownerId
  const isPlayerOwned = ownerId === sectId
  const isEnemyOwned = ownerId !== undefined && ownerId !== sectId

  return (
    <div className="recipe-card location-card">
      <div className="recipe-card-header">
        <h3>
          {location.kind === 'resource'
            ? getResourceArchetype(location.archetypeId).icon
            : getExplorationArchetype(location.archetypeId).icon}{' '}
          {location.name}
        </h3>
        <span className="recipe-discipline">Danger {location.dangerTier}</span>
      </div>

      {isPlayerOwned && <p className="recipe-meta">Held by your sect{hasOutpost ? ' — outpost established' : ''}.</p>}
      {isEnemyOwned && <p className="recipe-meta">Held by {ownerNpc?.name ?? 'an unknown sect'}.</p>}
      {location.runtime.knowledge > 0 && (
        <p className="recipe-meta">Survey knowledge: {Math.round(location.runtime.knowledge * 100)}%</p>
      )}

      {location.kind === 'resource' ? (
        <p className="panel-hint">
          Yields {formatYield(location.yieldPerVisit)} per cycle &middot; capacity{' '}
          {location.runtime.remainingCapacity === Infinity ? '∞' : location.runtime.remainingCapacity}
          {location.capacity !== Infinity ? ` / ${location.capacity}` : ''}
          {location.regenPerDay ? ` (+${location.regenPerDay}/day)` : ''}
        </p>
      ) : (
        <p className="panel-hint">
          {getExplorationArchetype(location.archetypeId).description} &middot; +
          {Math.round(location.knowledgePerVisit * 100)}% knowledge/visit
        </p>
      )}

      <p className="recipe-meta">
        Round trip {travelMs === Infinity ? '—' : formatDurationAdaptive((travelMs * 2) / 1000)} &middot; party ≤
        {location.maxParty} &middot; {formatDurationAdaptive(location.onSiteDurationMs / 1000)}/cycle
      </p>

      {upgradePath && (
        <p className="recipe-meta outpost-line">
          {hasOutpost
            ? `✔ Outpost established — passive ${formatOutpostBonus(upgradePath.level1.bonus)}`
            : `Claimable outpost: passive ${formatOutpostBonus(upgradePath.level1.bonus)}`}
        </p>
      )}

      {location.kind === 'resource' ? (
        <div className="location-card-actions">
          <button disabled={depleted || !onDispatch} onClick={onDispatch}>
            {depleted ? 'Depleted' : 'Send Expedition'}
          </button>
          {upgradePath && !hasOutpost && !isEnemyOwned && (
            <button disabled={!onClaim || !!claimBlocked} onClick={onClaim}>
              Claim Outpost
            </button>
          )}
          {upgradePath && isEnemyOwned && (
            <button disabled={!onClaim || !!claimBlocked} onClick={onClaim}>
              Seize Outpost
            </button>
          )}
          {isEnemyOwned && (
            <button disabled={!onRaid} onClick={onRaid}>
              Raid
            </button>
          )}
          {isPlayerOwned && (
            <button disabled={!onGarrison} onClick={onGarrison}>
              Manage Garrison
            </button>
          )}
          {!isPlayerOwned && (
            <button disabled={!onSurvey} onClick={onSurvey}>
              Survey
            </button>
          )}
        </div>
      ) : (
        <button disabled>Explore (coming soon)</button>
      )}

      {/*
       * §14, inline disclosure. Both of these used to live in a native `title=` attribute on
       * a disabled button — which on a portrait-phone-only game means **no player has ever
       * read them**: there is no hover, so the tooltip never fires. The reason a claim is
       * blocked is the single most useful sentence on this panel, and it was the one sentence
       * that could not be seen. `.upgrade-blocked-reason` is the pattern seven other
       * components already use for exactly this.
       */}
      {claimBlocked && location.kind === 'resource' && upgradePath && !hasOutpost && (
        <p className="upgrade-blocked-reason">{claimBlocked}</p>
      )}
      {location.kind !== 'resource' && (
        <p className="upgrade-blocked-reason">Exploration expeditions arrive in a later phase.</p>
      )}
    </div>
  )
}
