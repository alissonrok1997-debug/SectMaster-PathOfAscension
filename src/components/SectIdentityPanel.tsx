import { useGameStore } from '../game/state/store'
import { getSite } from '../game/engine/world/worldAccess'
import { ModifierBundleList } from './ModifierBundleList'

/**
 * What the land itself gives the sect (§16.1). This panel used to be "Sect Seat" and carried
 * the site name, province, spirit vein, building slots and travel offset alongside the
 * modifier bundle — all five of which were competing with the four other panels on the
 * screen. `SectHero` now owns the identity lines, and the slot/travel numbers were deleted
 * rather than moved: they already read on Buildings and World, where they're actionable.
 *
 * What's left is the one thing that had nowhere else to live — the seat's permanent
 * modifiers — under a diegetic title instead of an administrative one.
 */
export function SectIdentityPanel() {
  const sectLocation = useGameStore((s) => s.state.sectLocation)
  const world = useGameStore((s) => s.state.world)
  if (!sectLocation) return null

  const site = getSite(world, sectLocation.sectSiteId)

  return (
    <section className="panel">
      <h2>Blessings of the Land</h2>
      <ModifierBundleList bundle={site.modifiers} />
    </section>
  )
}
