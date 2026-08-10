import { SCREEN_TABS, type ScreenTabId } from '../game/data/screenTabs'
import { useGameStore } from '../game/state/store'

interface TabBarProps {
  active: ScreenTabId
  onSelect: (id: ScreenTabId) => void
}

export function TabBar({ active, onSelect }: TabBarProps) {
  const unread = useGameStore((s) => s.state.reports.filter((r) => !r.read).length)
  return (
    <nav className="tab-bar" aria-label="Sect screens">
      {SCREEN_TABS.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === active ? 'tab-button tab-button-active' : 'tab-button'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-button-icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
          {tab.id === 'reports' && unread > 0 && <span className="tab-button-badge">{unread}</span>}
        </button>
      ))}
    </nav>
  )
}
