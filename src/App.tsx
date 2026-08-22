import { useState } from 'react'
import { useGameLoop } from './components/useGameLoop'
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
import { BreakthroughOverlay } from './components/BreakthroughOverlay'
import { DecisionEventModal } from './components/DecisionEventModal'
import { FoundingScreen } from './components/FoundingScreen'
import { RelocationPruneModal } from './components/RelocationPruneModal'
import { EventToast } from './components/EventToast'
import { useWorldWatcher } from './components/useWorldWatcher'
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
  // Watches the store for outcomes the world produced on its own (§13). Reads only; it
  // publishes to `toastChannel`, which lives outside the store on purpose.
  useWorldWatcher()
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
      {/* Mounted here rather than in the detail sheet: `sheet-rise` animates a transform,
          which creates a containing block and would clip a position:fixed child. */}
      <BreakthroughOverlay />

      <div className="app-hud">
        <ResourceBar />
      </div>

      {/* Below `.app-hud` in the stack (z 19 vs 20), so it slides out from behind the
          resource strip rather than over it. */}
      <EventToast activeTab={activeTab} onNavigate={setActiveTab} />


      <main className="app-screen">{renderScreen(activeTab)}</main>

      <TabBar active={activeTab} onSelect={setActiveTab} />
    </div>
  )
}

export default App
