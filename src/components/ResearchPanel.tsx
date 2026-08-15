import { useState } from 'react'
import { useGameStore } from '../game/state/store'
import { RESEARCH_PROJECT_DEFS } from '../game/data/researchProjectDefs'
import { DOCTRINE_DEFS } from '../game/data/doctrineDefs'
import { getResearchDurationMs, getResearchEligibility } from '../game/engine/research'
import { formatCountdown } from '../game/utils/formatDuration'
import { formatResourceCost } from '../game/utils/formatResources'

export function ResearchPanel() {
  // Subscribing to the whole state so the in-progress research's countdown re-renders every tick.
  const state = useGameStore((s) => s.state)
  const startResearch = useGameStore((s) => s.startResearch)
  const chooseDoctrine = useGameStore((s) => s.chooseDoctrine)
  // Accordion, matching the mission board and crafting list. Projects and doctrines are
  // independent so a doctrine can stay open while comparing a project.
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [openDoctrineId, setOpenDoctrineId] = useState<string | null>(null)

  const queue = state.researchQueue
  const queuedProject = queue ? RESEARCH_PROJECT_DEFS.find((p) => p.id === queue.projectId) : undefined
  const completedCount = RESEARCH_PROJECT_DEFS.filter((p) => state.completedResearch.includes(p.id)).length

  return (
    <section className="panel research-panel">
      <h2>Doctrine</h2>

      {/* Pinned first: arriving here, "what's running and how long" beats the catalogue. */}
      {queue && queuedProject && (
        <div className="crafting-in-progress">
          <div className="progress-bar">
            <div
              className="progress-bar-fill construction"
              style={{
                width: `${Math.min(
                  100,
                  100 - ((queue.endsAt - Date.now()) / getResearchDurationMs(state, queuedProject.id)) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="panel-hint">
            Researching {queuedProject.name} &middot; {formatCountdown(queue.endsAt - Date.now())} remaining
          </p>
        </div>
      )}

      <p className="panel-hint">
        Spend Knowledge at the Research Institute for permanent sect-wide bonuses. One project at a time.
      </p>

      <h3 className="doctrine-section-title">
        Projects ({completedCount}/{RESEARCH_PROJECT_DEFS.length})
      </h3>
      <div className="recipe-grid">
        {RESEARCH_PROJECT_DEFS.map((project) => {
          const isCompleted = state.completedResearch.includes(project.id)
          const eligibility = getResearchEligibility(state, project.id)
          const expanded = openProjectId === project.id
          return (
            <div
              className={`recipe-card ${expanded ? 'expanded' : ''} ${isCompleted ? 'completed' : ''} ${
                !isCompleted && !eligibility.canResearch ? 'unaffordable' : ''
              }`}
              key={project.id}
            >
              <button
                type="button"
                className="recipe-card-header"
                aria-expanded={expanded}
                onClick={() => setOpenProjectId((current) => (current === project.id ? null : project.id))}
              >
                <span className="recipe-card-summary">
                  <span className="recipe-card-title">
                    <h3>{project.name}</h3>
                    <span className="recipe-discipline">{project.category}</span>
                  </span>
                  <span className="recipe-cost-line">
                    {isCompleted ? '✓ Completed' : formatResourceCost(project.cost)}
                  </span>
                </span>
                <span className="recipe-card-chevron" aria-hidden="true">
                  {expanded ? '⌃' : '›'}
                </span>
              </button>

              {expanded && (
                <div className="recipe-card-body">
                  <p className="panel-hint">{project.description}</p>
                  <p className="recipe-meta">{Math.round(project.durationMs / 1000)}s</p>
                  {!isCompleted && (
                    <>
                      <button
                        className="recipe-craft-button"
                        disabled={!eligibility.canResearch}
                        onClick={() => startResearch(project.id)}
                      >
                        Research
                      </button>
                      {!eligibility.canResearch && eligibility.reason && (
                        <p className="upgrade-blocked-reason">{eligibility.reason}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h3 className="doctrine-section-title">Sect Doctrine</h3>
      <p className="panel-hint">A permanent, one-time choice of philosophy for the sect — pick carefully.</p>
      <div className="recipe-grid">
        {DOCTRINE_DEFS.map((doctrine) => {
          const isChosen = state.doctrine === doctrine.id
          const alreadyChoseAnother = state.doctrine !== undefined && !isChosen
          const expanded = openDoctrineId === doctrine.id
          return (
            <div
              className={`recipe-card ${expanded ? 'expanded' : ''} ${isChosen ? 'selected' : ''}`}
              key={doctrine.id}
            >
              <button
                type="button"
                className="recipe-card-header"
                aria-expanded={expanded}
                onClick={() => setOpenDoctrineId((current) => (current === doctrine.id ? null : doctrine.id))}
              >
                <span className="recipe-card-summary">
                  <span className="recipe-card-title">
                    <h3>{doctrine.name}</h3>
                    {isChosen && <span className="recipe-discipline">Chosen</span>}
                  </span>
                  {/* Effects stay visible while collapsed: this is a one-time irreversible
                      pick, so the six options have to stay comparable without tapping each. */}
                  <span className="recipe-cost-line">{doctrine.effectsSummary}</span>
                </span>
                <span className="recipe-card-chevron" aria-hidden="true">
                  {expanded ? '⌃' : '›'}
                </span>
              </button>

              {expanded && (
                <div className="recipe-card-body">
                  <p className="panel-hint">{doctrine.belief}</p>
                  <button
                    className="recipe-craft-button"
                    disabled={isChosen || alreadyChoseAnother}
                    onClick={() => chooseDoctrine(doctrine.id)}
                  >
                    {isChosen ? 'Chosen' : 'Choose'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
