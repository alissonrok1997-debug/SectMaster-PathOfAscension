import type {
  ClimateId,
  NodeTemplateRoll,
  ProvinceId,
  ProvinceTheme,
  ProvinceUnlockRule,
  LocationId,
  MapPosition,
  SectSiteId,
} from '../../types'
import { SECT_SITE_DEFS } from './sectSiteDefs'
import { LANDMARK_DEFS } from './landmarkDefs'

/**
 * Provinces (WORLD_MAP_DESIGN §2). The First Realm collapses the old 3-province
 * starter world into a single self-contained province (FIRST_REALM_PLAN §1):
 * `neighbours: []` makes the worldGraph symmetric-check trivially pass, and
 * regions (Spirit Mountain / Ancient Forest / Desert / Forgotten Ruins) are a
 * flavour tag on sites/nodes, not a second navigational unit — every hop stays
 * intra-province, so `hubTravelUnits`/inter-province travel math goes inert and
 * distance is carried entirely by each site's `travelUnitOffset` and each
 * node's `travelUnits` (engine/world/travel.ts).
 *
 * `sectSiteIds`/`landmarkIds` are derived from the def arrays rather than
 * hand-listed, so the 32 sites + 52 nodes can never drift out of sync with
 * worldGraph's validation.
 */
export interface ProvinceDefinition {
  id: ProvinceId
  name: string
  theme: ProvinceTheme
  climate: ClimateId
  description: string
  spiritVeinTier: number
  difficultyTier: number
  neighbours: ProvinceId[]
  mapPosition: MapPosition
  mapShapeId: string
  hubTravelUnits: number
  sectSiteIds: SectSiteId[]
  landmarkIds: LocationId[]
  nodeTemplateWeights: NodeTemplateRoll[]
  controllingFactionId?: string
  unlockRule: ProvinceUnlockRule
}

export const PROVINCE_DEFS: ProvinceDefinition[] = [
  {
    id: 'firstRealm',
    name: 'The First Realm',
    theme: 'mountains',
    climate: 'temperate',
    description:
      'One vast, self-contained realm of Spirit Mountain, Ancient Forest, Desert, and Forgotten Ruins — 32 sect sites held by rival cultivators, waiting for someone to claim them.',
    spiritVeinTier: 2,
    difficultyTier: 2,
    neighbours: [],
    mapPosition: { x: 0.5, y: 0.5 },
    mapShapeId: 'firstRealm',
    hubTravelUnits: 0,
    sectSiteIds: SECT_SITE_DEFS.map((s) => s.id),
    landmarkIds: LANDMARK_DEFS.map((l) => l.id),
    nodeTemplateWeights: [],
    unlockRule: { kind: 'starter' },
  },
]

export function getProvinceDef(id: ProvinceId): ProvinceDefinition {
  const def = PROVINCE_DEFS.find((p) => p.id === id)
  if (!def) throw new Error(`Unknown province id: ${id}`)
  return def
}
