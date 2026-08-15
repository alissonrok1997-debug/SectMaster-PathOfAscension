import { useState } from 'react'
import type { RegionId, SectSiteTier } from '../game/types'
import { useGameStore } from '../game/state/store'
import { WORLD_DEF } from '../game/data/world/worldDef'
import { SECT_SITE_DEFS } from '../game/data/world/sectSiteDefs'
import { getInfluenceField } from '../game/engine/world/influence'
import { getHomeDisciples, getSeatDefenseLeaderId } from '../game/engine/world/territory'
import { SectSiteDetailPanel } from './SectSiteDetailPanel'
import { DispatchExpeditionModal } from './DispatchExpeditionModal'
import { BottomSheet } from './BottomSheet'

/** Tier drives pip size — Good seats read as the biggest prizes on the map. */
const TIER_RADIUS: Record<SectSiteTier, number> = { poor: 16, normal: 22, good: 28 }

/**
 * Minimum tap target in viewBox units. The map is 1000×700 rendered into a ~480px
 * portrait column (~0.48 px per unit), so 46 units ≈ 44 CSS px.
 */
const HIT_RADIUS = 46

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
  view,
  onSelectProvince,
}: {
  /** Owned by `WorldScreen` now: Sites and Map are segments of the one World subnav, not a
      second toggle stacked underneath it (§9, and the audit's "three nav layers" finding). */
  view: 'list' | 'map'
  onSelectProvince: (provinceId: string, regionId?: RegionId) => void
}) {
  const state = useGameStore((s) => s.state)
  const setDefenseLeader = useGameStore((s) => s.setDefenseLeader)
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

  const ownerLabel = (siteId: string): string => {
    if (siteId === sectLocation.sectSiteId) return 'Your seat'
    const ownerId = locations[siteId]?.ownerId
    if (ownerId === 'player') return 'Yours'
    if (!ownerId) return 'Free'
    return state.world?.npcSects.find((n) => n.id === ownerId)?.name ?? 'Held'
  }

  // Player seat first, then the biggest prizes. The map's spatial ordering is
  // meaningless in a list, so rank by what the player acts on.
  const sitesByInterest = [...SECT_SITE_DEFS].sort((a, b) => {
    const rank = (id: string) => (id === sectLocation.sectSiteId ? 0 : 1)
    const tierRank = { good: 0, normal: 1, poor: 2 } as const
    return rank(a.id) - rank(b.id) || tierRank[a.tier] - tierRank[b.tier] || a.name.localeCompare(b.name)
  })

  return (
    <section className="panel world-map-view">
      <div className="world-view-header">
        <h2>{WORLD_DEF.name}</h2>
      </div>

      {view === 'list' ? (
        <div className="site-list">
          {sitesByInterest.map((site) => (
            <button
              key={site.id}
              type="button"
              className={`site-row ${ownerClass(site.id)}`}
              onClick={() => setSelectedSiteId(site.id)}
            >
              <span className="site-row-text">
                <span className="site-row-name">{site.name}</span>
                <span className="site-row-owner">{ownerLabel(site.id)}</span>
              </span>
              <span className="site-row-tier-label">{site.tier}</span>
              <span className="site-row-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="world-map-svg-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="world-map-svg" role="img" aria-label="World map">
            {/*
             * §16.5's ink wash, as SVG rather than raster (§21.2): paper, a soft wash behind the
             * cluster, two low-contrast ridges, a grain pass and a vignette. Every layer is
             * darker than every node fill, so none of it costs node contrast.
             *
             * The grain rect is a *sibling* of the node graph, never an ancestor — as an
             * ancestor, every hover and selection would re-run the turbulence across 32 nodes.
             */}
            <defs>
              <radialGradient id="wm-wash" cx="0.5" cy="0.38" r="0.72">
                <stop offset="0" stopColor="#1b2430" stopOpacity="0.9" />
                <stop offset="1" stopColor="#1b2430" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="wm-vignette" cx="0.5" cy="0.45" r="0.72">
                <stop offset="0.55" stopColor="#0b0d12" stopOpacity="0" />
                <stop offset="1" stopColor="#0b0d12" stopOpacity="0.55" />
              </radialGradient>
              <filter id="wm-grain" x="0" y="0" width="100%" height="100%">
                {/* numOctaves 2, not 3–4: one rasterisation at first paint is affordable, four is not. */}
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="n" />
                <feColorMatrix in="n" type="saturate" values="0" />
              </filter>
            </defs>
            <rect width={W} height={H} fill="var(--bg)" />
            <rect width={W} height={H} fill="url(#wm-wash)" />
            <path
              d={`M0 ${H * 0.78}L${W * 0.16} ${H * 0.6}L${W * 0.3} ${H * 0.71}L${W * 0.47} ${H * 0.52}L${W * 0.63} ${H * 0.68}L${W * 0.81} ${H * 0.56}L${W} ${H * 0.73}V${H}H0Z`}
              fill="var(--surface)"
              opacity="0.28"
            />
            <path
              d={`M0 ${H * 0.88}L${W * 0.22} ${H * 0.74}L${W * 0.41} ${H * 0.85}L${W * 0.58} ${H * 0.7}L${W * 0.78} ${H * 0.83}L${W} ${H * 0.76}V${H}H0Z`}
              fill="var(--surface-raised)"
              opacity="0.22"
            />
            <rect width={W} height={H} filter="url(#wm-grain)" opacity="0.05" pointerEvents="none" />
            <rect width={W} height={H} fill="url(#wm-vignette)" pointerEvents="none" />
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
              const isSeat = site.id === sectLocation.sectSiteId
              const cls = `world-map-node site-tier-${site.tier} ${ownerClass(site.id)}${selected ? ' selected' : ''}`
              return (
                <g key={site.id} className={cls} onClick={() => setSelectedSiteId(site.id)} style={{ cursor: 'pointer' }}>
                  {/* Transparent hit target: tier radii are 16–28 viewBox units, which
                      scale to well under a finger at portrait width. */}
                  <circle cx={px} cy={py} r={Math.max(r, HIT_RADIUS)} fill="transparent" />
                  {/* A seal, not a pip (§16.5): a filled disc inside a thin ring, with ownership
                      on the ring and site state on the disc, so the two never fight. */}
                  <circle className="node-disc" cx={px} cy={py} r={r * 0.72} />
                  <circle className="node-ring" cx={px} cy={py} r={r} />
                  {/*
                   * All 32 labels render but only the selected site, the player's seat and the
                   * hovered node are visible — 32 labels at once is ~2000px of text in a 432px
                   * box. Revealing on hover is CSS-only and costs no motion budget.
                   */}
                  <text
                    x={px}
                    y={py + r + 22}
                    className={`world-map-label${selected || isSeat ? ' shown' : ''}`}
                    textAnchor="middle"
                  >
                    {site.name}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {/* Moved below the content: the audit's fix for `.panel-hint` occupying the highest-priority
          slot on every screen is positional. The rules still matter, they just aren't the headline. */}
      <p className="panel-hint world-map-rules">
        Poor sites are always safe; Normal and Good sites are held by rival sects and can be raided or conquered.
        Claim and Garrison on a resource node only work inside your influence range.
      </p>

      <BottomSheet
        open={selectedSite !== undefined}
        onClose={() => setSelectedSiteId(null)}
        title={selectedSite?.name}
        height="full"
      >
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
            seatDefense={
              selectedSite.id === sectLocation.sectSiteId
                ? {
                    disciples: getHomeDisciples(state),
                    effectiveLeaderId: getSeatDefenseLeaderId(state),
                    chosenLeaderId: state.defenseLeaderId,
                    onSelect: setDefenseLeader,
                  }
                : undefined
            }
          />
        )}
      </BottomSheet>

      <div className="founding-nav">
        <button onClick={() => onSelectProvince(sectLocation.provinceId)}>View Resource Nodes &amp; Expeditions</button>
      </div>

      {dispatch && (
        <DispatchExpeditionModal locationId={dispatch.locationId} purpose={dispatch.purpose} onClose={() => setDispatch(null)} />
      )}
    </section>
  )
}
