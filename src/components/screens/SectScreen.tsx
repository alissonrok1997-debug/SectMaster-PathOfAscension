import { SectHero } from '../SectHero'
import { SectIdentityPanel } from '../SectIdentityPanel'
import { OnboardingChecklist } from '../OnboardingChecklist'
import { EventLogPanel } from '../EventLogPanel'

/**
 * The landing screen (§16.1). Was `OnboardingChecklist` over a `.panel-grid` of four
 * equal-weight boxes — rank, seat, and *two clocks* — with the Chronicle beneath. The four
 * boxes are now one hero block: rank and seat folded into it, both clocks collapsed to a
 * single 0.72rem line, and the engine-documentation hints deleted outright.
 *
 * `.panel-grid` is gone from this screen; it only ever held those four.
 */
export function SectScreen() {
  return (
    <>
      <SectHero />
      <OnboardingChecklist />
      <SectIdentityPanel />
      <EventLogPanel />
    </>
  )
}
