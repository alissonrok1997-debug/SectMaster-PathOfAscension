import { useEffect, useRef } from 'react'
import { SCREEN_TABS, type ScreenTabId } from '../game/data/screenTabs'
import { useGameStore } from '../game/state/store'

interface TabBarProps {
  active: ScreenTabId
  onSelect: (id: ScreenTabId) => void
}

/**
 * Fixed bottom navigation. All 9 tabs live in one horizontally scrollable bar with 5
 * visible at a time — the edge mask in CSS is the only cue that it scrolls, so don't
 * remove it.
 */
export function TabBar({ active, onSelect }: TabBarProps) {
  const unread = useGameStore((s) => s.state.reports.filter((r) => !r.read).length)
  const barRef = useRef<HTMLElement>(null)

  // Tabs can change programmatically (onboarding steps, report links); an off-screen
  // active tab makes that look like nothing happened.
  useEffect(() => {
    barRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <nav className="tab-bar" aria-label="Sect screens" ref={barRef}>
      {SCREEN_TABS.map((tab) => (
        <button
          key={tab.id}
          className={tab.id === active ? 'tab-button tab-button-active' : 'tab-button'}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-button-icon" aria-hidden="true">
            {tab.icon}
            {tab.id === 'reports' && unread > 0 && <span className="tab-button-badge">{unread}</span>}
          </span>
          <span className="tab-button-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
