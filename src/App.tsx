import { useState } from 'react'
import { useGameLoop } from './game/engine/useGameLoop'
import { ResourceBar } from './components/ResourceBar'
import { TabBar } from './components/TabBar'
import { SectScreen } from './components/screens/SectScreen'
import { BuildingsScreen } from './components/screens/BuildingsScreen'
import { DisciplesScreen } from './components/screens/DisciplesScreen'
import { MissionsScreen } from './components/screens/MissionsScreen'
import { WorkshopScreen } from './components/screens/WorkshopScreen'
import { ResearchScreen } from './components/screens/ResearchScreen'
import { WorldScreen } from './components/screens/WorldScreen'
import { ReportsScreen } from './components/screens/ReportsScreen'
import { SystemScreen } from './components/screens/SystemScreen'
import { OfflineSummaryModal } from './components/OfflineSummaryModal'
import { DecisionEventModal } from './components/DecisionEventModal'
import { FoundingScreen } from './components/FoundingScreen'
import { RelocationPruneModal } from './components/RelocationPruneModal'
import { DEFAULT_SCREEN_TAB, type ScreenTabId } from './game/data/screenTabs'
import { useGameStore } from './game/state/store'

function renderScreen(tab: ScreenTabId) {
  switch (tab) {
    case 'sect':
      return <SectScreen />
    case 'buildings':
      return <BuildingsScreen />
    case 'disciples':
      return <DisciplesScreen />
    case 'missions':
      return <MissionsScreen />
    case 'workshop':
      return <WorkshopScreen />
    case 'research':
      return <ResearchScreen />
    case 'world':
      return <WorldScreen />
    case 'reports':
      return <ReportsScreen />
    case 'system':
      return <SystemScreen />
  }
}

function App() {
  useGameLoop()
  const isFounded = useGameStore((s) => s.state.sectLocation !== undefined)
  const pendingRelocation = useGameStore((s) => s.state.pendingRelocation)
  const offlineSummary = useGameStore((s) => s.offlineSummary)
  const [activeTab, setActiveTab] = useState<ScreenTabId>(DEFAULT_SCREEN_TAB)

  // Pre-game: the founding flow renders instead of the whole game shell (§12.2).
  if (!isFounded) return <FoundingScreen />
  // A winning seat-claim over building capacity gates the shell the same way, until pruned (FIRST_REALM_PLAN §4.2/§7).
  if (pendingRelocation) return <RelocationPruneModal />

  return (
    <div className="app">
      {/* Portrait-only: shown by CSS on a phone turned sideways, never on desktop. */}
      <div className="rotate-prompt" aria-hidden="true">
        <p>Rotate your device to portrait</p>
      </div>

      <OfflineSummaryModal />
      {!offlineSummary && <DecisionEventModal />}

      <div className="app-hud">
        <ResourceBar />
      </div>

      <main className="app-screen">{renderScreen(activeTab)}</main>

      <TabBar active={activeTab} onSelect={setActiveTab} />
    </div>
  )
}

export default App
