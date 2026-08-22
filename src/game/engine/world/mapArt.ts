import { Delaunay } from 'd3-delaunay'
import type { RegionId, SectSiteId, SectSiteTier } from '../../types'
import { hashString, mulberry32 } from '../rng'

/**
 * Procedural map art (WORLD_PROCGEN_PLAN Wave 0). Turns the 64 seat points into
 * territory cells — Voronoi polygons with organic, hand-inked borders and a
 * biome tint — rendered *behind* the existing seals. Pure and deterministic:
 * `computeRealmArt(sites, seed, viewBox)` is a value transform with no store or
 * DOM contact, memoised once per load in `WorldMapView` (never in the 250 ms
 * tick — the `worldGraph` "compute once at init" discipline).
 *
 * Crux (design §Wave 0): borders are **watertight**. Each undirected Voronoi
 * edge is distorted once, cached by a coordinate key, and both neighbouring
 * cells reuse that identical distorted polyline — so no seams or overlaps open
 * up between adjacent territories.
 */

/** Minimal seat shape the art needs — decoupled from `SectSiteDefinition` so callers pass a projection. */
export interface MapArtSite {
  id: SectSiteId
  regionId: RegionId
  tier: SectSiteTier
  /** Normalised map position (0..1), as stored on the site def. */
  mapPosition: { x: number; y: number }
}

/** A flat biome silhouette placed inside a cell — the glyph is chosen by region, drawn at `scale`. */
export interface Silhouette {
  x: number
  y: number
  scale: number
}

export interface MapArtCell {
  id: SectSiteId
  regionId: RegionId
  tier: SectSiteTier
  /** SVG path `d` of the distorted cell polygon (closed), in viewBox pixel units. */
  path: string
  /** Cell centroid in pixel units (seat point, projected). */
  seat: { x: number; y: number }
  /** Axis-aligned bounds `[minX, minY, maxX, maxY]` in pixel units — the zoom target. */
  bbox: [number, number, number, number]
  /** Ids of Voronoi-adjacent cells. */
  neighbours: SectSiteId[]
  /** Biome silhouettes scattered inside the cell, clear of the seal. */
  silhouettes: Silhouette[]
}

export interface RealmArt {
  cells: MapArtCell[]
  /** viewBox the paths are drawn into. */
  width: number
  height: number
}

/** How many interior points each edge is subdivided into before displacement. More = wigglier ink, costlier path. */
const EDGE_SEGMENTS = 6
/** Peak perpendicular displacement of an edge midpoint, in pixels. Tuned against a 1000×900 board. */
const EDGE_AMPLITUDE = 9

/** Rounded-coordinate key for an undirected edge, so both cells that share it hash to the same bucket. */
function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  const a = `${Math.round(ax)},${Math.round(ay)}`
  const b = `${Math.round(bx)},${Math.round(by)}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Displace one straight edge `a→b` into a hand-inked polyline. The displacement
 * is seeded off the (order-independent) edge key so the exact same wobble is
 * produced no matter which cell asks for it, and returned oriented `a→b` — the
 * caller reverses it when it traverses the edge the other way.
 */
function distortEdge(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  seed: number,
): Array<[number, number]> {
  const key = edgeKey(ax, ay, bx, by)
  const rng = mulberry32((hashString(key) ^ seed) >>> 0)
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  // Unit normal to the edge — displacement is perpendicular, so the border bulges rather than lengthens.
  const nx = -dy / len
  const ny = dx / len
  // Amplitude eases to zero at both endpoints (sin envelope) so shared corners stay pinned and watertight.
  const scale = Math.min(1, len / 120)
  const pts: Array<[number, number]> = []
  for (let i = 1; i < EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS
    const px = ax + dx * t
    const py = ay + dy * t
    const envelope = Math.sin(Math.PI * t)
    const offset = (rng() * 2 - 1) * EDGE_AMPLITUDE * envelope * scale
    pts.push([px + nx * offset, py + ny * offset])
  }
  return pts
}

/** Signed-area magnitude of a polygon ring (shoelace), in px². */
function polygonArea(ring: Array<[number, number]>): number {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(a) / 2
}

/** Ray-cast point-in-polygon on an undistorted cell ring. */
function pointInPolygon(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Clearance (px) kept between a silhouette and the seal, so glyphs never crowd the node. */
const SILHOUETTE_SEAT_CLEAR = 30

/**
 * Scatter a few biome silhouettes inside a cell, clear of the seal and of each
 * other. Seeded off the cell id so the scatter is stable across loads. The
 * undistorted `ring` is used for containment — the border noise is small enough
 * that a glyph inside the raw cell stays inside the inked one.
 */
function scatterSilhouettes(
  id: SectSiteId,
  ring: Array<[number, number]>,
  seatX: number,
  seatY: number,
  bbox: [number, number, number, number],
  seed: number,
): Silhouette[] {
  const area = polygonArea(ring)
  const count = area > 22000 ? 3 : area > 9000 ? 2 : 1
  const glyphScale = Math.min(1.5, Math.max(0.65, Math.sqrt(area) / 130))
  const minSep = 34
  const rng = mulberry32((hashString(`silhouette:${id}`) ^ seed) >>> 0)
  const [x0, y0, x1, y1] = bbox
  const out: Silhouette[] = []
  for (let tries = 0; tries < count * 12 && out.length < count; tries++) {
    const x = x0 + rng() * (x1 - x0)
    const y = y0 + rng() * (y1 - y0)
    if (Math.hypot(x - seatX, y - seatY) < SILHOUETTE_SEAT_CLEAR) continue
    if (!pointInPolygon(x, y, ring)) continue
    if (out.some((s) => Math.hypot(s.x - x, s.y - y) < minSep)) continue
    out.push({ x, y, scale: glyphScale })
  }
  return out
}

/** One cell's inking input: its identity plus its polygon ring and seat in pixel units. */
interface CellInput {
  id: SectSiteId
  regionId: RegionId
  tier: SectSiteTier
  seatPx: { x: number; y: number }
  /** Cell polygon ring in pixel units (open — no repeated closing vertex). */
  ringPx: Array<[number, number]>
  neighbours: SectSiteId[]
}

/**
 * Ink a set of cells into art. Every undirected edge is distorted once and cached by a
 * coordinate key, so both cells that meet along it reuse the identical polyline — watertight
 * borders, no seams. Shared by both entry points (seat-Voronoi and stored polygons).
 */
function inkCells(inputs: CellInput[], seed: number, W: number, H: number): RealmArt {
  const edgeCache = new Map<string, Array<[number, number]>>()
  const inkedEdge = (ax: number, ay: number, bx: number, by: number): Array<[number, number]> => {
    const key = edgeKey(ax, ay, bx, by)
    let mid = edgeCache.get(key)
    if (!mid) {
      mid = distortEdge(ax, ay, bx, by, seed)
      edgeCache.set(key, mid)
    }
    const aKey = `${Math.round(ax)},${Math.round(ay)}`
    const bKey = `${Math.round(bx)},${Math.round(by)}`
    return aKey < bKey ? mid : [...mid].reverse()
  }

  const cells: MapArtCell[] = inputs.map((cell) => {
    const { x: seatX, y: seatY } = cell.seatPx
    const ring = cell.ringPx
    if (ring.length < 3) {
      return { id: cell.id, regionId: cell.regionId, tier: cell.tier, path: '', seat: { x: seatX, y: seatY }, bbox: [seatX, seatY, seatX, seatY], neighbours: cell.neighbours, silhouettes: [] }
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const track = (x: number, y: number) => {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }

    let d = ''
    for (let v = 0; v < ring.length; v++) {
      const [ax, ay] = ring[v]
      const [bx, by] = ring[(v + 1) % ring.length]
      if (v === 0) {
        d += `M${ax.toFixed(1)} ${ay.toFixed(1)}`
        track(ax, ay)
      }
      for (const [mx, my] of inkedEdge(ax, ay, bx, by)) {
        d += `L${mx.toFixed(1)} ${my.toFixed(1)}`
        track(mx, my)
      }
      d += `L${bx.toFixed(1)} ${by.toFixed(1)}`
      track(bx, by)
    }
    d += 'Z'

    const bbox: [number, number, number, number] = [minX, minY, maxX, maxY]
    return {
      id: cell.id,
      regionId: cell.regionId,
      tier: cell.tier,
      path: d,
      seat: { x: seatX, y: seatY },
      bbox,
      neighbours: cell.neighbours,
      silhouettes: scatterSilhouettes(cell.id, ring, seatX, seatY, bbox, seed),
    }
  })

  return { cells, width: W, height: H }
}

/**
 * Build territory art for a set of seats by computing the Voronoi from the seat points (Wave 0
 * path — used before a generated blueprint exists, and for legacy blueprints with no polygons).
 */
export function computeRealmArt(
  sites: MapArtSite[],
  seed: number,
  viewBox: { width: number; height: number },
): RealmArt {
  const { width: W, height: H } = viewBox
  // Flat [x0,y0,x1,y1,…] coordinate array — the form `new Delaunay(Float64Array)` expects.
  // (`Delaunay.from` would treat each number as its own point.)
  const coords = new Float64Array(sites.length * 2)
  for (let i = 0; i < sites.length; i++) {
    coords[i * 2] = sites[i].mapPosition.x * W
    coords[i * 2 + 1] = sites[i].mapPosition.y * H
  }
  const delaunay = new Delaunay(coords)
  const voronoi = delaunay.voronoi([0, 0, W, H])

  const inputs: CellInput[] = sites.map((site, i) => {
    const poly = voronoi.cellPolygon(i) as Array<[number, number]> | null
    return {
      id: site.id,
      regionId: site.regionId,
      tier: site.tier,
      seatPx: { x: site.mapPosition.x * W, y: site.mapPosition.y * H },
      ringPx: poly && poly.length >= 4 ? poly.slice(0, poly.length - 1) : [],
      neighbours: [...voronoi.neighbors(i)].map((n) => sites[n].id),
    }
  })
  return inkCells(inputs, seed, W, H)
}

/** A generated territory the art consumes — the subset of `GeneratedTerritory` mapArt needs. */
export interface MapArtTerritory {
  id: SectSiteId
  regionId: RegionId
  tier: SectSiteTier
  seat: { x: number; y: number }
  neighbours: SectSiteId[]
  /** Normalised Voronoi cell polygon (the generator owns geometry from Wave 2 on). */
  polygon?: Array<[number, number]>
}

/**
 * Build territory art from the generator's stored polygons (Wave 2). Geometry is owned by the
 * generator; the art just inks the normalised polygons — scaling them to the viewBox — so the
 * same seed drives the same borders here as in the blueprint.
 */
export function computeRealmArtFromTerritories(
  territories: MapArtTerritory[],
  seed: number,
  viewBox: { width: number; height: number },
): RealmArt {
  const { width: W, height: H } = viewBox
  const inputs: CellInput[] = territories.map((t) => ({
    id: t.id,
    regionId: t.regionId,
    tier: t.tier,
    seatPx: { x: t.seat.x * W, y: t.seat.y * H },
    ringPx: (t.polygon ?? []).map(([x, y]) => [x * W, y * H] as [number, number]),
    neighbours: t.neighbours,
  }))
  return inkCells(inputs, seed, W, H)
}

/** True when the blueprint's territories carry generated polygons (Wave 2+); legacy blueprints don't. */
export function hasTerritoryPolygons(territories: MapArtTerritory[]): boolean {
  return territories.length > 0 && territories.every((t) => Array.isArray(t.polygon) && t.polygon.length >= 3)
}
