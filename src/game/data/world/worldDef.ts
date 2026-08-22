import type { ProvinceId } from '../../types'
import { PROVINCE_DEFS } from './provinceDefs'

/**
 * The single world container (WORLD_MAP_DESIGN §3.1): world name, its province id
 * list, the map artwork viewBox, and the subset of provinces selectable at
 * founding. `foundingProvinceIds` is derived from each province's `starter`
 * unlock rule so the two can never disagree.
 */
export interface WorldDefinition {
  name: string
  provinceIds: ProvinceId[]
  foundingProvinceIds: ProvinceId[]
  map: { viewBoxWidth: number; viewBoxHeight: number }
}

export const WORLD_DEF: WorldDefinition = {
  name: 'The First Realm',
  provinceIds: PROVINCE_DEFS.map((p) => p.id),
  foundingProvinceIds: PROVINCE_DEFS.filter((p) => p.unlockRule.kind === 'starter').map((p) => p.id),
  map: { viewBoxWidth: 1000, viewBoxHeight: 900 },
}
