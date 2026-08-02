import { useState } from 'react'
import type { RegionId, SectSiteTier } from '../game/types'
import { useGameStore } from '../game/state/store'
import { WORLD_DEF } from '../game/data/world/worldDef'
import { SECT_SITE_DEFS } from '../game/data/world/sectSiteDefs'
import { getInfluenceField } from '../game/engine/world/influence'
import { SectSiteDetailPanel } from './SectSiteDetailPanel'
import { DispatchExpeditionModal } from './DispatchExpeditionModal'

/** Tier drives pip size — Good seats read as the biggest prizes on the map. */
const TIER_RADIUS: Record<SectSiteTier, number> = { poor: 16, normal: 22, good: 28 }

/**
 * The world overview (FIRST_REALM_PLAN §7). With a single province (§1) the
 * map shows all 32 sect sites directly, colour-coded by who holds them, with
 * the sect's influence bubble shaded underneath (§4.6) — Claim/Garrison on a
 * resource node only work inside it, though seat conquest never does (§1).
 * Resource nodes + expedition dispatch stay behind the "View Resource Nodes"
 * button, which always opens the one province. Subscribes narrowly to
 * world.locations (ownership can change without a countdown driving
 * re-renders every 250ms, §12 pitfall #12).
 */
export function WorldMapView({
  onSelectProvince,
}: {
  onSelectProvince: (provinceId: string, regionId?: RegionId) => void
}) {
  const state = useGameStore((s) => s.state)
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [dispatch, setDispatch] = useState<{ locationId: string; purpose: 'raid' | 'claim' | 'survey' } | null>(null)

  const locations = state.world?.locations
  const sectLocation = state.sectLocation
  if (!locations || !sectLocation || !state.world) return null

  const { viewBoxWidth: W, viewBoxHeight: H } = WORLD_DEF.map
  const selectedSite = selectedSiteId ? SECT_SITE_DEFS.find((s) => s.id === selectedSiteId) : undefined
  const influence = getInfluenceField(state)
  const anyExpeditionOut = state.world.expeditions.length > 0

  const ownerClass = (siteId: string): string => {
    if (siteId === sectLocation.sectSiteId) return 'owner-player'
    const ownerId = locations[siteId]?.ownerId
    if (ownerId === 'player') return 'owner-player'
    if (ownerId) return 'owner-npc'
    return 'owner-neutral'
  }

  return (
    <section className="panel world-map-view">
      <h2>{WORLD_DEF.name}</h2>
      <p className="panel-hint">
        Click a sect site to inspect who holds it. Poor sites (small, green) are always safe; Normal and Good sites
        (larger) are held by rival sects and can be raided or conquered. The shaded field is your sect's influence
        range — Claim/Garrison on a resource node only work inside it.
      </p>
      <div className="world-map-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="world-map-svg" role="img" aria-label="World map">
          <circle
            className="world-map-influence"
            cx={influence.center.x * W}
            cy={influence.center.y * H}
            r={influence.radius * Math.min(W, H)}
          />
          {SECT_SITE_DEFS.map((site) => {
            const r = TIER_RADIUS[site.tier]
            const px = site.mapPosition.x * W
            const py = site.mapPosition.y * H
            const selected = site.id === selectedSiteId
            const cls = `world-map-node site-tier-${site.tier} ${ownerClass(site.id)}${selected ? ' selected' : ''}`
            return (
              <g key={site.id} className={cls} onClick={() => setSelectedSiteId(site.id)} style={{ cursor: 'pointer' }}>
                <circle cx={px} cy={py} r={r} />
                <text x={px} y={py + r + 16} className="world-map-label" textAnchor="middle">
                  {site.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {selectedSite && (
        <SectSiteDetailPanel
          site={selectedSite}
          runtime={locations[selectedSite.id]}
          isPlayerSeat={selectedSite.id === sectLocation.sectSiteId}
          npc={state.world.npcSects.find((n) => n.id === locations[selectedSite.id]?.ownerId)}
          anyExpeditionOut={anyExpeditionOut}
          onRaid={() => setDispatch({ locationId: selectedSite.id, purpose: 'raid' })}
          onClaimSeat={() => setDispatch({ locationId: selectedSite.id, purpose: 'claim' })}
          onSurvey={() => setDispatch({ locationId: selectedSite.id, purpose: 'survey' })}
          onViewResources={() => onSelectProvince(sectLocation.provinceId, selectedSite.regionId)}
        />
      )}

      <div className="founding-nav">
        <button onClick={() => onSelectProvince(sectLocation.provinceId)}>View Resource Nodes &amp; Expeditions</button>
      </div>

      {dispatch && (
        <DispatchExpeditionModal locationId={dispatch.locationId} purpose={dispatch.purpose} onClose={() => setDispatch(null)} />
      )}
    </section>
  )
}
