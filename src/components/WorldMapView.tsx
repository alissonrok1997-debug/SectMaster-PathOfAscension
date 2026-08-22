import { useEffect, useMemo, useRef, useState } from 'react'
import { UiIcon } from './UiIcon'
import type { RegionId, SectSiteTier } from '../game/types'
import { useGameStore } from '../game/state/store'
import { WORLD_DEF } from '../game/data/world/worldDef'
import { getInfluenceField } from '../game/engine/world/influence'
import { getSites } from '../game/engine/world/worldAccess'
import { computeRealmArt, computeRealmArtFromTerritories, hasTerritoryPolygons } from '../game/engine/world/mapArt'
import { getHomeDisciples, getSeatDefenseLeaderId } from '../game/engine/world/territory'
import { SectSiteDetailPanel } from './SectSiteDetailPanel'
import { DispatchExpeditionModal } from './DispatchExpeditionModal'
import { BottomSheet } from './BottomSheet'

/** Tier drives pip size — Good seats read as the biggest prizes on the map. */
const TIER_RADIUS: Record<SectSiteTier, number> = { poor: 16, normal: 22, good: 28 }

/**
 * Flat biome silhouettes (Wave 0), drawn centred on the anchor and scaled: a mountain ridge,
 * a pine, a dune, broken pillars. Signalled by region so a glance reads the land, not just its tint.
 */
const BIOME_GLYPH: Record<RegionId, string> = {
  spiritMountain: 'M-9 5 L-3 -6 L1 -1 L4 -4 L9 5 Z',
  ancientForest: 'M0 -8 L4 -1 L1.6 -1 L5 5 L-5 5 L-1.6 -1 L-4 -1 Z',
  desert: 'M-9 4 Q -3 -3 1 1 Q 4 3 9 3 L9 5 L-9 5 Z',
  forgottenRuins: 'M-8 5 L-8 -4 L-5 -4 L-5 5 Z M-1.5 5 L-1.5 -6 L1.5 -6 L1.5 5 Z M5 5 L5 -1 L8 -1 L8 5 Z',
  // A four-pointed star — the realm's qi converging on the heart.
  heavenlyAxis: 'M0 -9 L2 -2 L9 0 L2 2 L0 9 L-2 2 L-9 0 L-2 -2 Z',
}

/** Zoom padding (viewBox units) around a focused territory's bbox, and the cap on zoom scale. */
const ZOOM_PAD = 40
const ZOOM_MAX = 4

/**
 * Minimum tap target in viewBox units. The map is 1000×900 rendered into a ~480px
 * portrait column (~0.48 px per unit), so 46 units ≈ 44 CSS px.
 */
const HIT_RADIUS = 46

/**
 * The world overview (FIRST_REALM_PLAN §7). With a single province (§1) the
 * map shows all 64 sect sites directly, colour-coded by who holds them, with
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
  onSelectProvince: (provinceId: string, territoryId?: string) => void
}) {
  const state = useGameStore((s) => s.state)
  const setDefenseLeader = useGameStore((s) => s.setDefenseLeader)
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [zoomedSiteId, setZoomedSiteId] = useState<string | null>(null)
  const [dispatch, setDispatch] = useState<{ locationId: string; purpose: 'raid' | 'claim' | 'survey' } | null>(null)

  // Territory art is a pure transform of the seats/polygons + seed — computed once per load
  // (never in the 250 ms tick), memoised on the seed. Wave 2 inks the generator's stored polygons
  // when present; legacy blueprints (and any pre-blueprint path) fall back to a seat-Voronoi.
  const worldSeed = state.world?.seed ?? 0
  const blueprint = state.world?.blueprint
  const realmArt = useMemo(() => {
    const viewBox = { width: WORLD_DEF.map.viewBoxWidth, height: WORLD_DEF.map.viewBoxHeight }
    const territories = blueprint?.territories ?? []
    if (hasTerritoryPolygons(territories)) return computeRealmArtFromTerritories(territories, worldSeed, viewBox)
    return computeRealmArt(getSites(state.world), worldSeed, viewBox)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSeed, blueprint])

  // The map renders larger than the column and pans (64 seats need room, DOUBLE_SEATS_PLAN §Phase 2).
  // Center the view on the player's seat on open / world change, and on the focused territory while
  // zoomed — the zoom camera parks the focus at the SVG midpoint, so we scroll that midpoint in.
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (view !== 'map') return
    const wrap = wrapRef.current
    const world = state.world
    if (!wrap || !world) return
    const seatId = state.sectLocation?.sectSiteId
    const seat = seatId ? getSites(world).find((s) => s.id === seatId) : undefined
    const fx = zoomedSiteId ? 0.5 : seat?.mapPosition.x ?? 0.5
    const fy = zoomedSiteId ? 0.5 : seat?.mapPosition.y ?? 0.5
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
    wrap.scrollTo({
      left: clamp(fx * wrap.scrollWidth - wrap.clientWidth / 2, wrap.scrollWidth - wrap.clientWidth),
      top: clamp(fy * wrap.scrollHeight - wrap.clientHeight / 2, wrap.scrollHeight - wrap.clientHeight),
      behavior: zoomedSiteId ? 'smooth' : 'auto',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, worldSeed, zoomedSiteId, state.sectLocation?.sectSiteId])

  const locations = state.world?.locations
  const sectLocation = state.sectLocation
  if (!locations || !sectLocation || !state.world) return null

  const { viewBoxWidth: W, viewBoxHeight: H } = WORLD_DEF.map
  // Seats come from the generated blueprint (Wave 2), read through the shim.
  const sites = getSites(state.world)
  const selectedSite = selectedSiteId ? sites.find((s) => s.id === selectedSiteId) : undefined
  const influence = getInfluenceField(state)
  const anyExpeditionOut = state.world.expeditions.length > 0

  // Zoom is a CSS transform on a camera <g> (SVG viewBox isn't animatable): scale the
  // focused territory's padded bbox up to fill the board, capped so tiny cells don't
  // over-magnify. px on an SVG element are user units, so this transitions smoothly.
  const zoomedCell = zoomedSiteId ? realmArt.cells.find((c) => c.id === zoomedSiteId) : undefined
  let cameraTransform = 'translate(0px, 0px) scale(1)'
  if (zoomedCell) {
    const [x0, y0, x1, y1] = zoomedCell.bbox
    const bw = x1 - x0 + ZOOM_PAD * 2
    const bh = y1 - y0 + ZOOM_PAD * 2
    const scale = Math.min(ZOOM_MAX, Math.min(W / bw, H / bh))
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    cameraTransform = `translate(${(W / 2 - scale * cx).toFixed(1)}px, ${(H / 2 - scale * cy).toFixed(1)}px) scale(${scale.toFixed(3)})`
  }

  // Realm scale: tapping a territory drills into it. Territory scale: tapping the focused
  // seat opens its action sheet, while tapping another cell re-focuses there.
  const onPickSite = (siteId: string) => {
    if (zoomedSiteId === siteId) setSelectedSiteId(siteId)
    else setZoomedSiteId(siteId)
  }

  const ownerClass = (siteId: string): string => {
    if (siteId === sectLocation.sectSiteId) return 'owner-player'
    const ownerId = locations[siteId]?.ownerId
    if (ownerId === state.sectId) return 'owner-player'
    if (ownerId) return 'owner-npc'
    return 'owner-neutral'
  }

  const ownerLabel = (siteId: string): string => {
    if (siteId === sectLocation.sectSiteId) return 'Your seat'
    const ownerId = locations[siteId]?.ownerId
    if (ownerId === state.sectId) return 'Yours'
    if (!ownerId) return 'Free'
    return state.world?.npcSects.find((n) => n.id === ownerId)?.name ?? 'Held'
  }

  // Player seat first, then the biggest prizes. The map's spatial ordering is
  // meaningless in a list, so rank by what the player acts on.
  const sitesByInterest = [...sites].sort((a, b) => {
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
                <UiIcon className="ui-chevron" name="chevron" size={20} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="world-map-svg-wrap" ref={wrapRef}>
          <svg viewBox={`0 0 ${W} ${H}`} className="world-map-svg" role="img" aria-label="World map">
            {/*
             * §16.5's ink wash, as SVG rather than raster (§21.2): paper, a soft wash behind the
             * cluster, two low-contrast ridges, a grain pass and a vignette. Every layer is
             * darker than every node fill, so none of it costs node contrast.
             *
             * The grain rect is a *sibling* of the node graph, never an ancestor — as an
             * ancestor, every hover and selection would re-run the turbulence across 64 nodes.
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
            {/* Camera: a single transformed group so click-to-zoom scales the whole scene at once,
                animated via CSS transform (SVG viewBox can't transition). */}
            <g className="world-map-camera" style={{ transform: cameraTransform, transformOrigin: '0 0' }}>
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
            {/*
             * Territory cells (Wave 0): Voronoi land tinted by biome, with hand-inked shared
             * borders, rendered behind the grain/vignette-lit ground and under the seals so the
             * map reads as claimed land. Clicking a cell drills into that territory.
             */}
            <g className="world-map-cells">
              {realmArt.cells.map((cell) => (
                <path
                  key={cell.id}
                  className={`world-map-cell region-${cell.regionId}${cell.id === zoomedSiteId ? ' zoomed' : cell.id === selectedSiteId ? ' selected' : ''}`}
                  d={cell.path}
                  onClick={() => onPickSite(cell.id)}
                />
              ))}
            </g>
            {/* Flat biome silhouettes scattered inside the cells — land signalled by shape, not just tint. */}
            <g className="world-map-silhouettes" pointerEvents="none">
              {realmArt.cells.flatMap((cell) =>
                cell.silhouettes.map((s, si) => (
                  <path
                    key={`${cell.id}-${si}`}
                    className={`world-map-silhouette region-${cell.regionId}`}
                    d={BIOME_GLYPH[cell.regionId]}
                    transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) scale(${s.scale.toFixed(2)})`}
                  />
                )),
              )}
            </g>
            <rect width={W} height={H} filter="url(#wm-grain)" opacity="0.05" pointerEvents="none" />
            <rect width={W} height={H} fill="url(#wm-vignette)" pointerEvents="none" />
            <circle
              className="world-map-influence"
              cx={influence.center.x * W}
              cy={influence.center.y * H}
              r={influence.radius * Math.min(W, H)}
            />
            {sites.map((site) => {
              const r = TIER_RADIUS[site.tier]
              const px = site.mapPosition.x * W
              const py = site.mapPosition.y * H
              const selected = site.id === selectedSiteId
              const isSeat = site.id === sectLocation.sectSiteId
              const focused = site.id === zoomedSiteId
              const cls = `world-map-node site-tier-${site.tier} ${ownerClass(site.id)}${selected ? ' selected' : ''}${focused ? ' zoomed' : ''}`
              return (
                <g key={site.id} className={cls} onClick={() => onPickSite(site.id)} style={{ cursor: 'pointer' }}>
                  {/* Transparent hit target: tier radii are 16–28 viewBox units, which
                      scale to well under a finger at portrait width. */}
                  <circle cx={px} cy={py} r={Math.max(r, HIT_RADIUS)} fill="transparent" />
                  {/* A seal, not a pip (§16.5): a filled disc inside a thin ring, with ownership
                      on the ring and site state on the disc, so the two never fight. */}
                  <circle className="node-disc" cx={px} cy={py} r={r * 0.72} />
                  <circle className="node-ring" cx={px} cy={py} r={r} />
                  {/*
                   * All 64 labels render but only the selected site, the player's seat and the
                   * hovered node are visible — 64 labels at once would swamp the board. Revealing
                   * on hover is CSS-only and costs no motion budget.
                   */}
                  <text
                    x={px}
                    y={py + r + 22}
                    className={`world-map-label${selected || isSeat || focused ? ' shown' : ''}`}
                    textAnchor="middle"
                  >
                    {site.name}
                  </text>
                </g>
              )
            })}
            </g>
          </svg>
          {zoomedCell && (
            <button type="button" className="world-map-zoom-out" onClick={() => setZoomedSiteId(null)}>
              ← Realm
            </button>
          )}
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
            sectId={state.sectId}
            site={selectedSite}
            runtime={locations[selectedSite.id]}
            isPlayerSeat={selectedSite.id === sectLocation.sectSiteId}
            npc={state.world.npcSects.find((n) => n.id === locations[selectedSite.id]?.ownerId)}
            anyExpeditionOut={anyExpeditionOut}
            onRaid={() => setDispatch({ locationId: selectedSite.id, purpose: 'raid' })}
            onClaimSeat={() => setDispatch({ locationId: selectedSite.id, purpose: 'claim' })}
            onSurvey={() => setDispatch({ locationId: selectedSite.id, purpose: 'survey' })}
            onViewResources={() => onSelectProvince(sectLocation.provinceId, selectedSite.id)}
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
