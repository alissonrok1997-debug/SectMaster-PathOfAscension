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
import { SystemScreen } from './components/screens/SystemScreen'
import { OfflineSummaryModal } from './components/OfflineSummaryModal'
import { DecisionEventModal } from './components/DecisionEventModal'
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
    case 'system':
      return <SystemScreen />
  }
}

function App() {
  useGameLoop()
  const offlineSummary = useGameStore((s) => s.offlineSummary)
  const [activeTab, setActiveTab] = useState<ScreenTabId>(DEFAULT_SCREEN_TAB)

  return (
    <div className="app">
      <OfflineSummaryModal />
      {!offlineSummary && <DecisionEventModal />}

      <header className="app-header">
        <h1>Sect Master: Path of Ascension</h1>
        <p className="app-subtitle">Wave 8 — Onboarding, Polish &amp; Live-Readiness</p>
      </header>

      <div className="app-hud">
        <ResourceBar />
        <TabBar active={activeTab} onSelect={setActiveTab} />
      </div>

      <main className="app-screen">{renderScreen(activeTab)}</main>

      <footer className="app-footer">
        <p>Equip crafted gear from a Disciple Card to raise their Combat Power.</p>
      </footer>
    </div>
  )
}

export default App
