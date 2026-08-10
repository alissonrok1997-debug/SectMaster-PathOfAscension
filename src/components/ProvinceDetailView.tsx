import { useState } from 'react'
import type { ExpeditionPurpose, RegionId, Resources } from '../game/types'
import { useGameStore } from '../game/state/store'
import { getProvinceDef } from '../game/data/world/provinceDefs'
import { getNeighbours } from '../game/data/world/worldGraph'
import { getProvinceSpiritVein } from '../game/engine/world/worldQueries'
import { getTravelTime } from '../game/engine/world/travel'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import {
  availableResourceKeys,
  browseNodes,
  createNodeBrowseFilter,
  type NodeOwnership,
  type NodeSort,
} from '../game/engine/world/nodeBrowse'
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

const OWNERSHIP_OPTIONS: { value: NodeOwnership; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
  { value: 'unclaimed', label: 'Unclaimed' },
  { value: 'rival', label: 'Rival-held' },
]

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
  // Local, reset on every visit — never lifted or saved (NODE_FILTER_SORT_PLAN §2).
  const [filter, setFilter] = useState(() => createNodeBrowseFilter(regionId))

  const province = getProvinceDef(provinceId)
  const vein = getProvinceSpiritVein(provinceId)
  const resourceKeys = availableResourceKeys(state, provinceId, regionId)
  const { locations, totalInScope, hiddenDepletedCount } = browseNodes(state, provinceId, filter)

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

      {totalInScope > 0 && (
        <div className="node-filter-row">
          <div className="founding-chip-row">
            {OWNERSHIP_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className={`founding-chip${filter.ownership === value ? ' founding-chip-active' : ''}`}
                onClick={() => setFilter((f) => ({ ...f, ownership: value }))}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="node-filter-toggle">
            <input
              type="checkbox"
              checked={!filter.hideDepleted}
              onChange={(e) => setFilter((f) => ({ ...f, hideDepleted: !e.target.checked }))}
            />
            Show depleted
          </label>
          {resourceKeys.length > 0 && (
            <select
              className="node-filter-select"
              value={filter.resource ?? ''}
              onChange={(e) =>
                setFilter((f) => ({ ...f, resource: e.target.value ? (e.target.value as keyof Resources) : null }))
              }
            >
              <option value="">All resources</option>
              {resourceKeys.map((key) => (
                <option key={key} value={key}>
                  {RESOURCE_LABELS[key]}
                </option>
              ))}
            </select>
          )}
          <select
            className="node-filter-select"
            value={filter.sort}
            onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value as NodeSort }))}
          >
            <option value="nearest">Sort: Nearest</option>
            <option value="richest">
              Sort: {filter.resource ? `Richest (${RESOURCE_LABELS[filter.resource]}/hr)` : 'Richest'}
            </option>
            <option value="safest">Sort: Safest</option>
            <option value="mine">Sort: My holdings</option>
            <option value="name">Sort: Name</option>
          </select>
          <span className="node-filter-count">
            {locations.length} of {totalInScope} nodes
          </span>
        </div>
      )}

      {totalInScope === 0 && <p className="panel-hint">No resource nodes in this region.</p>}
      {totalInScope > 0 && locations.length === 0 && hiddenDepletedCount > 0 && (
        <p className="panel-hint">
          Only depleted nodes match — turn on <strong>Show depleted</strong> to see them.
        </p>
      )}
      {totalInScope > 0 && locations.length === 0 && hiddenDepletedCount === 0 && (
        <p className="panel-hint">
          No nodes match these filters.{' '}
          <button className="link-button" onClick={() => setFilter(createNodeBrowseFilter(regionId))}>
            Clear filters
          </button>
        </p>
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
