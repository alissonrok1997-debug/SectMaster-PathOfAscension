import { useGameStore } from '../game/state/store'
import { getProvinceDef } from '../game/data/world/provinceDefs'
import { getSectSiteDef } from '../game/data/world/sectSiteDefs'
import { getBuildingSlotUsage } from '../game/engine/world/siteCapacity'
import { SpiritVeinBadge } from './SpiritVeinBadge'
import { ModifierBundleList } from './ModifierBundleList'

/**
 * Shows the permanent founding identity on the Sect screen (§12.4). The site's
 * modifier bundle is displayed here; wiring it into the actual production /
 * cultivation math is the next phase (§16 Phase 3).
 */
export function SectIdentityPanel() {
  const sectLocation = useGameStore((s) => s.state.sectLocation)
  if (!sectLocation) return null

  const province = getProvinceDef(sectLocation.provinceId)
  const site = getSectSiteDef(sectLocation.sectSiteId)
  const slots = useGameStore((s) => getBuildingSlotUsage(s.state))

  return (
    <section className="panel">
      <h2>Sect Seat</h2>
      <p>
        <strong>{site.name}</strong>, {province.name}{' '}
        <span className="panel-hint">({province.theme} · {province.climate})</span>
      </p>
      <p>
        <SpiritVeinBadge tier={province.spiritVeinTier} />
      </p>
      <p className="panel-hint">
        Building slots: {slots.used}/{slots.total} used · travel offset {site.travelUnitOffset >= 0 ? '+' : ''}
        {site.travelUnitOffset}
      </p>
      <ModifierBundleList bundle={site.modifiers} />
    </section>
  )
}
