import { MissionBoard } from '../MissionBoard'
import { ActiveMissionsPanel } from '../ActiveMissionsPanel'
import { MissionLogPanel } from '../MissionLogPanel'

export function MissionsScreen() {
  return (
    <>
      <MissionBoard />
      <ActiveMissionsPanel />
      <MissionLogPanel />
    </>
  )
}
