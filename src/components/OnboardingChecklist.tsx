import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { getOnboardingObjectives, isOnboardingComplete } from '../game/engine/onboarding'

export function OnboardingChecklist() {
  // Whole-state subscription so every objective re-checks on any relevant change, same pattern as ResearchPanel's countdown.
  const state = useGameStore((s) => s.state)
  const [collapsed, setCollapsed] = useState(false)

  const objectives = getOnboardingObjectives(state)
  if (isOnboardingComplete(objectives)) {
    return null
  }

  return (
    <section className="panel onboarding-checklist">
      <div className="onboarding-checklist-header">
        <h2>Getting Started</h2>
        <button className="onboarding-collapse-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed && (
        <>
          <p className="panel-hint">A few first steps to see every core system in action.</p>
          <ul className="onboarding-objective-list">
            {objectives.map((o) => (
              <li key={o.id} className={o.isComplete ? 'onboarding-objective-done' : ''}>
                {o.isComplete ? '✓' : '○'} {o.label}
              </li>
            ))}
          </ul>
          {/* Moved here from the old app footer, which portrait has no room for. */}
          <p className="panel-hint">
            Tip: equip crafted gear from a disciple's detail sheet to raise their Combat Power.
          </p>
        </>
      )}
    </section>
  )
}
