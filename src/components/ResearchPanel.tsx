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

  const queue = state.researchQueue
  const queuedProject = queue ? RESEARCH_PROJECT_DEFS.find((p) => p.id === queue.projectId) : undefined

  return (
    <section className="panel research-panel">
      <h2>Research &amp; Sect Identity</h2>
      <p className="panel-hint">
        Spend Knowledge at the Research Institute to unlock permanent sect-wide bonuses. Single research queue — only
        one project at a time, sect-wide.
      </p>

      {queue && queuedProject && (
        <div className="crafting-in-progress">
          <div className="progress-bar">
            <div
              className="progress-bar-fill day"
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

      <div className="recipe-grid">
        {RESEARCH_PROJECT_DEFS.map((project) => {
          const isCompleted = state.completedResearch.includes(project.id)
          const eligibility = getResearchEligibility(state, project.id)
          return (
            <div className="recipe-card" key={project.id}>
              <div className="recipe-card-header">
                <h3>{project.name}</h3>
                <span className="recipe-discipline">{project.category}</span>
              </div>
              <p className="panel-hint">{project.description}</p>
              <p className="recipe-meta">
                {formatResourceCost(project.cost)} &middot; {Math.round(project.durationMs / 1000)}s
              </p>
              {isCompleted ? (
                <button disabled>Completed</button>
              ) : (
                <>
                  <button disabled={!eligibility.canResearch} onClick={() => startResearch(project.id)}>
                    Research
                  </button>
                  {!eligibility.canResearch && eligibility.reason && (
                    <p className="upgrade-blocked-reason">{eligibility.reason}</p>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <h3 className="doctrine-section-title">Sect Doctrine</h3>
      <p className="panel-hint">
        A permanent, one-time choice of philosophy for the sect — pick carefully.
      </p>
      <div className="recipe-grid">
        {DOCTRINE_DEFS.map((doctrine) => {
          const isChosen = state.doctrine === doctrine.id
          const alreadyChoseAnother = state.doctrine !== undefined && !isChosen
          return (
            <div className={`recipe-card ${isChosen ? 'selected' : ''}`} key={doctrine.id}>
              <div className="recipe-card-header">
                <h3>{doctrine.name}</h3>
              </div>
              <p className="panel-hint">{doctrine.belief}</p>
              <p className="recipe-meta">{doctrine.effectsSummary}</p>
              <button disabled={isChosen || alreadyChoseAnother} onClick={() => chooseDoctrine(doctrine.id)}>
                {isChosen ? 'Chosen' : 'Choose'}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
