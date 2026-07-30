import { SectRankPanel } from '../SectRankPanel'
import { SectIdentityPanel } from '../SectIdentityPanel'
import { SimClockPanel } from '../SimClockPanel'
import { WorldClockPanel } from '../WorldClockPanel'
import { OnboardingChecklist } from '../OnboardingChecklist'
import { EventLogPanel } from '../EventLogPanel'

export function SectScreen() {
  return (
    <>
      <OnboardingChecklist />
      <div className="panel-grid">
        <SectRankPanel />
        <SectIdentityPanel />
        <SimClockPanel />
        <WorldClockPanel />
      </div>
      <EventLogPanel />
    </>
  )
}
