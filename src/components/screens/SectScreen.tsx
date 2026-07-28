import { SectRankPanel } from '../SectRankPanel'
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
        <SimClockPanel />
        <WorldClockPanel />
      </div>
      <EventLogPanel />
    </>
  )
}
