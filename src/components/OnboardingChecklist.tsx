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
        <h2>The Master's Instructions</h2>
        <button className="quiet onboarding-collapse-toggle" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? 'Resume' : 'Set aside'}
        </button>
      </div>
      {!collapsed && (
        <>
          <p className="panel-hint">Attend to these, and the sect will find its footing.</p>
          <ul className="onboarding-objective-list">
            {objectives.map((o, i) => (
              /*
               * Only the first unfulfilled instruction is stressed — a master gives one
               * task at a time. Fulfilled rows dim but keep their label intact: an
               * instruction obeyed is not an instruction cancelled, so no line-through.
               */
              <li
                key={o.id}
                className={[
                  'instruction-row',
                  o.isComplete ? 'onboarding-objective-done' : '',
                  !o.isComplete && objectives.findIndex((x) => !x.isComplete) === i ? 'current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* A ledger diamond rather than a checkbox tick — this is a master's record. */}
                <span className="instruction-marker" aria-hidden="true" />
                <span>{o.label}</span>
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
