import type { DiscipleInstance, LocationRuntime, NpcSect, SectSiteTier } from '../game/types'
import type { SectSiteDefinition } from '../game/data/world/sectSiteDefs'
import { getDiscipleCombatTrait, TRAIT_EFFECTS } from '../game/engine/combatPower'
import { ModifierBundleList } from './ModifierBundleList'

/** Seat-defense leader picker (Combat Polishing Phase 6) — shown only on the player's own seat. */
export interface SeatDefenseProps {
  disciples: DiscipleInstance[]
  /** Who currently leads the defense (the chosen disciple, or the highest-grade fallback). */
  effectiveLeaderId?: string
  /** The explicit player choice; undefined means "auto (highest grade)". */
  chosenLeaderId?: string
  onSelect: (discipleId: string | undefined) => void
}

const TIER_LABELS: Record<SectSiteTier, string> = { poor: 'Poor', normal: 'Normal', good: 'Good' }

/** Owner summary from the LIVE npcSects roster — never the static seat→def seed data, which goes stale the instant a seat changes hands (FIRST_REALM_PLAN §4.2). */
function describeOwner(runtime: LocationRuntime | undefined, isPlayerSeat: boolean, npc: NpcSect | undefined, tier: SectSiteTier): string {
  if (isPlayerSeat || runtime?.ownerId === 'player') return 'Your Sect'
  if (runtime?.ownerId) return npc?.name ?? 'An unknown sect'
  return tier === 'poor' ? 'Unclaimed (safe)' : 'Unclaimed'
}

/**
 * Seat inspector (FIRST_REALM_PLAN §7). Read-only ownership summary plus, once
 * Wave B's dispatch flow is reachable, Raid/Conquer entry points — gated by
 * conquerability, relocation-readiness (any expedition still out blocks a seat
 * claim, §4.2), and never offered for the player's own seat.
 */
export function SectSiteDetailPanel({
  site,
  runtime,
  isPlayerSeat,
  npc,
  anyExpeditionOut,
  onRaid,
  onClaimSeat,
  onSurvey,
  onViewResources,
  seatDefense,
}: {
  site: SectSiteDefinition
  runtime: LocationRuntime | undefined
  isPlayerSeat: boolean
  npc: NpcSect | undefined
  anyExpeditionOut: boolean
  onRaid?: () => void
  onClaimSeat?: () => void
  onSurvey?: () => void
  /** Jump to the province's resource-node & expedition list from this seat. */
  onViewResources?: () => void
  seatDefense?: SeatDefenseProps
}) {
  const garrisonStrength = isPlayerSeat ? undefined : runtime?.garrison?.strength
  const isEnemyOwned = runtime?.ownerId !== undefined && runtime.ownerId !== 'player'

  return (
    <div className="recipe-card location-card site-detail-card">
      <div className="recipe-card-header">
        <h3>{site.name}</h3>
        <span className="recipe-discipline">{TIER_LABELS[site.tier]}</span>
      </div>
      <p className="panel-hint">{site.description}</p>
      <p className="recipe-meta">
        Held by: <strong>{describeOwner(runtime, isPlayerSeat, npc, site.tier)}</strong>
        {npc ? ` (${npc.tier})` : ''}
      </p>
      {garrisonStrength !== undefined && <p className="recipe-meta">Garrison strength: {garrisonStrength}</p>}
      {runtime && runtime.knowledge > 0 && (
        <p className="recipe-meta">Survey knowledge: {Math.round(runtime.knowledge * 100)}%</p>
      )}
      <p className="panel-hint">
        {site.buildingSlots} building slots · travel offset {site.travelUnitOffset >= 0 ? '+' : ''}
        {site.travelUnitOffset}
        {!site.conquerable ? ' · never conquerable' : ''}
      </p>
      <ModifierBundleList bundle={site.modifiers} />

      {isPlayerSeat && seatDefense && seatDefense.disciples.length > 0 && (
        <div className="dispatch-preview">
          <p className="panel-hint">Defense leader (their trait shapes seat defenses):</p>
          <div className="assign-disciple-choices">
            <button
              className={`assign-disciple-choice ${seatDefense.chosenLeaderId === undefined ? 'selected' : ''}`}
              onClick={() => seatDefense.onSelect(undefined)}
            >
              <span className="assign-disciple-name">{seatDefense.chosenLeaderId === undefined ? '✓ ' : ''}Auto (highest grade)</span>
            </button>
            {seatDefense.disciples.map((d) => (
              <button
                key={d.id}
                className={`assign-disciple-choice ${seatDefense.effectiveLeaderId === d.id ? 'selected' : ''}`}
                onClick={() => seatDefense.onSelect(d.id)}
              >
                <span className="assign-disciple-name">
                  {seatDefense.effectiveLeaderId === d.id ? '✓ ' : ''}
                  {d.name} — {TRAIT_EFFECTS[getDiscipleCombatTrait(d)].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {onViewResources && (
        <div className="location-card-actions">
          <button onClick={onViewResources}>Show this location's resource nodes &amp; expeditions</button>
        </div>
      )}

      {!isPlayerSeat && isEnemyOwned && (
        <div className="location-card-actions">
          {onRaid && <button onClick={onRaid}>Raid</button>}
          {onSurvey && <button onClick={onSurvey}>Survey</button>}
          {site.conquerable && onClaimSeat && (
            <button disabled={anyExpeditionOut} onClick={onClaimSeat}>
              Conquer &amp; Relocate
            </button>
          )}
        </div>
      )}
      {!isPlayerSeat && isEnemyOwned && site.conquerable && anyExpeditionOut && (
        <p className="panel-hint">Recall every expedition and garrison before conquering a new seat.</p>
      )}
    </div>
  )
}
