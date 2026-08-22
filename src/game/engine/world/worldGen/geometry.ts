import { Delaunay } from 'd3-delaunay'
import type { RegionId } from '../../../types'
import type { WorldGenConfig } from './worldGenConfig'

/**
 * Point sampling + Voronoi (WORLD_PROCGEN_PLAN Wave 2, geometry stage). Seats are dart-thrown
 * with a blue-noise minimum separation inside each region's corner quadrant, skipping the central
 * hub disc — except The Heavenly Axis, whose seats are sampled *inside* the disc. Region membership
 * is the area the seat was sampled in (one contiguous corner each plus the hub, all five present), then one
 * Lloyd relaxation pass evens the spacing. Voronoi over the 64 points yields the cell polygons the
 * art inks and the Delaunay-dual adjacency the blueprint stores. All randomness comes from the
 * caller's seeded RNG, so the layout is deterministic per seed.
 */

export interface SampledPoint {
  x: number
  y: number
  regionId: RegionId
}

export interface Geometry {
  points: SampledPoint[]
  /** Voronoi cell polygon per point, normalised [0,1] rings (open — no repeated closing vertex). */
  polygons: Array<Array<[number, number]>>
  /** Delaunay-dual neighbour indices per point. */
  adjacency: number[][]
}

/**
 * Dart-throw `count` points into a rectangle with a minimum separation, relaxing the bar if it
 * stalls. `accepts` is a hard gate the relaxation never loosens — it carves the hub disc out.
 */
function dartThrow(
  rng: () => number,
  count: number,
  bounds: { x0: number; x1: number; y0: number; y1: number },
  accepts: (x: number, y: number) => boolean,
): Array<[number, number]> {
  const { x0, x1, y0, y1 } = bounds
  const pts: Array<[number, number]> = []
  // Start from a separation that comfortably fits `count` in the quadrant, easing down on repeated misses.
  let minDist = Math.sqrt(((x1 - x0) * (y1 - y0)) / count) * 0.7
  let sinceHit = 0
  while (pts.length < count) {
    const x = x0 + rng() * (x1 - x0)
    const y = y0 + rng() * (y1 - y0)
    if (accepts(x, y) && pts.every((p) => Math.hypot(p[0] - x, p[1] - y) >= minDist)) {
      pts.push([x, y])
      sinceHit = 0
    } else if (++sinceHit > 40) {
      minDist *= 0.8
      sinceHit = 0
    }
  }
  return pts
}

/** Fisher–Yates in place using the given RNG. */
function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function buildVoronoi(points: SampledPoint[]): { polygons: Array<Array<[number, number]>>; adjacency: number[][] } {
  const coords = new Float64Array(points.length * 2)
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x
    coords[i * 2 + 1] = points[i].y
  }
  const delaunay = new Delaunay(coords)
  const voronoi = delaunay.voronoi([0, 0, 1, 1])
  const polygons = points.map((_, i) => {
    const poly = voronoi.cellPolygon(i) as Array<[number, number]> | null
    if (!poly || poly.length < 4) return []
    return poly.slice(0, poly.length - 1) // drop the repeated closing vertex
  })
  const adjacency = points.map((_, i) => [...voronoi.neighbors(i)])
  return { polygons, adjacency }
}

export function generateGeometry(rng: () => number, config: WorldGenConfig): Geometry {
  const { cx: hubX, cy: hubY, r: hubR } = config.hub
  const distHub = (x: number, y: number) => Math.hypot(x - hubX, y - hubY)
  const outsideHub = (x: number, y: number) => distHub(x, y) >= hubR
  // The Heavenly Axis is the one region sampled *inside* the disc; rim regions are sampled outside it.
  const insideHub = (x: number, y: number) => distHub(x, y) < hubR

  // Randomise which corner each rim region occupies (the Axis keeps the centre). A region's identity
  // — biome, resource, names, danger offset — travels with its id; only the corner rect it samples in
  // is shuffled, so no two seeds share a corner layout while every region stays itself.
  const rimRegions = config.regions.filter((r) => r.id !== 'heavenlyAxis')
  const shuffledRimIds = shuffleInPlace(rimRegions.map((r) => r.id), rng)
  const boundsById = new Map<RegionId, { x0: number; x1: number; y0: number; y1: number }>()
  rimRegions.forEach((r, i) => boundsById.set(shuffledRimIds[i], r.bounds))
  for (const r of config.regions) if (r.id === 'heavenlyAxis') boundsById.set(r.id, r.bounds)

  const points: SampledPoint[] = []
  for (const region of config.regions) {
    const accepts = region.id === 'heavenlyAxis' ? insideHub : outsideHub
    for (const [x, y] of dartThrow(rng, region.size, boundsById.get(region.id)!, accepts)) {
      points.push({ x, y, regionId: region.id })
    }
  }

  // One Lloyd pass: move each seat toward its Voronoi cell centroid, then clamp back into its
  // region quadrant and out of the hub disc, so the corners stay contiguous and the centre stays
  // clear. Evens the blue-noise spacing without crossing regions.
  const { polygons } = buildVoronoi(points)
  for (let i = 0; i < points.length; i++) {
    const ring = polygons[i]
    if (ring.length < 3) continue
    let cx = 0
    let cy = 0
    for (const [px, py] of ring) {
      cx += px
      cy += py
    }
    cx /= ring.length
    cy /= ring.length
    const b = boundsById.get(points[i].regionId)!
    let x = Math.min(b.x1, Math.max(b.x0, cx))
    let y = Math.min(b.y1, Math.max(b.y0, cy))
    const dist = Math.hypot(x - hubX, y - hubY)
    if (points[i].regionId === 'heavenlyAxis') {
      // The Axis lives inside the disc: a centroid that drifted out is pulled back onto the rim.
      if (dist > hubR) {
        const scale = hubR / Math.max(dist, 1e-6)
        x = hubX + (x - hubX) * scale
        y = hubY + (y - hubY) * scale
      }
    } else if (dist < hubR) {
      // A rim centroid that drifted into the hub is pushed back out along its radius, then re-clamped.
      // The centre lies outside every quadrant, so the push always moves away from the inner corner.
      const scale = hubR / Math.max(dist, 1e-6)
      x = Math.min(b.x1, Math.max(b.x0, hubX + (x - hubX) * scale))
      y = Math.min(b.y1, Math.max(b.y0, hubY + (y - hubY) * scale))
    }
    points[i] = { x, y, regionId: points[i].regionId }
  }

  const { polygons: finalPolys, adjacency } = buildVoronoi(points)
  return { points, polygons: finalPolys, adjacency }
}
