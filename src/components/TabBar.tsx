import { SCREEN_TABS, type ScreenTabId } from '../game/data/screenTabs'

interface TabBarProps {
  active: ScreenTabId
  onSelect: (id: ScreenTabId) => void
}

export function TabBar({ active, onSelect }: TabBarProps) {
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
        </button>
      ))}
    </nav>
  )
}
