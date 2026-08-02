import { useState } from 'react'
import type { ExpeditionPurpose, RegionId } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getProvinceDef } from '../game/data/world/provinceDefs'
import { getNeighbours } from '../game/data/world/worldGraph'
import { getProvinceSpiritVein, getVisibleLocations } from '../game/engine/world/worldQueries'
import { getTravelTime } from '../game/engine/world/travel'
import { getRegionForPosition } from '../game/engine/world/regionIndex'
import { getOutpostClaimEligibility } from '../game/engine/world/expeditions'
import { LocationDetailPanel } from './LocationDetailPanel'
import { DispatchExpeditionModal } from './DispatchExpeditionModal'
import { GarrisonPanel } from './GarrisonPanel'

const REGION_LABELS: Record<RegionId, string> = {
  spiritMountain: 'Spirit Mountain',
  ancientForest: 'Ancient Forest',
  desert: 'Desert',
  forgottenRuins: 'Forgotten Ruins',
}

/**
 * The Province layer (WORLD_MAP_DESIGN §3.3 / §12.3): the locations within one
 * province, each with its live travel time and a dispatch entry point. Subscribes
 * to the whole state so location runtime (remaining capacity) stays current. An
 * optional `regionId` narrows the list to one region's nodes — how a sect site's
 * "Show this location's resource nodes" button scopes to its own area.
 */
export function ProvinceDetailView({
  provinceId,
  regionId,
  onBack,
}: {
  provinceId: string
  regionId?: RegionId
  onBack: () => void
}) {
  const state = useGameStore((s) => s.state)
  const [dispatch, setDispatch] = useState<{ locationId: string; purpose: ExpeditionPurpose } | null>(null)
  const [garrisonLocationId, setGarrisonLocationId] = useState<string | null>(null)

  const province = getProvinceDef(provinceId)
  const vein = getProvinceSpiritVein(provinceId)
  // Claimed (player-held) nodes first, then nearest by travel time — which is now
  // real map distance from the seat, so the order matches both the round-trip
  // label on each card and the influence bubble. When scoped to a region, only
  // that region's nodes are shown (region derived from each node's nearest site).
  const locations = [...getVisibleLocations(state, provinceId)]
    .filter((loc) => regionId === undefined || getRegionForPosition(loc.mapPosition) === regionId)
    .sort((a, b) => {
      const aClaimed = a.runtime.ownerId === 'player' ? 0 : 1
      const bClaimed = b.runtime.ownerId === 'player' ? 0 : 1
      if (aClaimed !== bClaimed) return aClaimed - bClaimed
      return getTravelTime(state, a.id) - getTravelTime(state, b.id)
    })

  return (
    <section className="panel province-detail-view">
      <button className="world-back-button" onClick={onBack}>
        ← Back to map
      </button>
      <h2>
        {province.name}
        {regionId ? ` — ${REGION_LABELS[regionId]}` : ''}
      </h2>
      <p className="panel-hint">
        {regionId ? `Resource nodes in the ${REGION_LABELS[regionId]} region.` : province.description}
      </p>
      <p className="recipe-meta">
        Spirit Vein: <strong>{vein.name}</strong> &middot; Difficulty {province.difficultyTier} &middot; Neighbours:{' '}
        {getNeighbours(provinceId).map((n) => getProvinceDef(n).name).join(', ') || 'none'}
        {province.controllingFactionId ? ` · Contested by ${province.controllingFactionId}` : ''}
      </p>

      {locations.length === 0 && (
        <p className="panel-hint">No resource nodes in this region.</p>
      )}

      <div className="recipe-grid">
        {locations.map((loc) => {
          const ownerId = loc.runtime.ownerId
          const isEnemyOwned = ownerId !== undefined && ownerId !== 'player'
          const claim = loc.kind === 'resource' ? getOutpostClaimEligibility(state, loc.id) : undefined
          return (
            <LocationDetailPanel
              key={loc.id}
              location={loc}
              travelMs={getTravelTime(state, loc.id)}
              ownerNpc={state.world?.npcSects.find((n) => n.id === ownerId)}
              claimBlocked={claim && !claim.canDispatch ? claim.reason : undefined}
              onDispatch={loc.kind === 'resource' ? () => setDispatch({ locationId: loc.id, purpose: 'gather' }) : undefined}
              onClaim={loc.kind === 'resource' ? () => setDispatch({ locationId: loc.id, purpose: 'claim' }) : undefined}
              onRaid={isEnemyOwned ? () => setDispatch({ locationId: loc.id, purpose: 'raid' }) : undefined}
              onGarrison={ownerId === 'player' ? () => setGarrisonLocationId(loc.id) : undefined}
              onSurvey={ownerId !== 'player' ? () => setDispatch({ locationId: loc.id, purpose: 'survey' }) : undefined}
            />
          )
        })}
      </div>

      {dispatch && (
        <DispatchExpeditionModal
          locationId={dispatch.locationId}
          purpose={dispatch.purpose}
          onClose={() => setDispatch(null)}
        />
      )}
      {garrisonLocationId && (
        <GarrisonPanel locationId={garrisonLocationId} onClose={() => setGarrisonLocationId(null)} />
      )}
    </section>
  )
}
