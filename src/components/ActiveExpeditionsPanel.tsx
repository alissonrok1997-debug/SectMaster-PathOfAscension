import type { Expedition, ExpeditionPhase, Resources } from '../game/types'
import { useGameStore } from '../game/state/store'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { getLocationDefFromState } from '../game/engine/world/worldQueries'
import { SECT_SITE_DEFS } from '../game/data/world/sectSiteDefs'
import { formatCountdown } from '../game/utils/formatDuration'

const PHASE_LABEL: Record<ExpeditionPhase, string> = {
  outbound: 'Travelling out',
  onSite: 'On site',
  returning: 'Returning home',
}

function payloadLine(expedition: Expedition): string {
  const entries = Object.entries(expedition.payload.resources) as [keyof Resources, number][]
  if (entries.length === 0) return 'nothing yet'
  return entries.map(([key, amount]) => `${Math.floor(amount)} ${RESOURCE_LABELS[key]}`).join(', ')
}

/**
 * Active expeditions (WORLD_MAP_DESIGN §12.3), mirroring ActiveMissionsPanel. Takes
 * the whole-state subscription because it shows live phase countdowns (§12.6).
 */
export function ActiveExpeditionsPanel() {
  const state = useGameStore((s) => s.state)
  const recallExpedition = useGameStore((s) => s.recallExpedition)

  const expeditions = state.world?.expeditions ?? []
  if (expeditions.length === 0) {
    return (
      <section className="panel active-expeditions-panel">
        <h2>Active Expeditions</h2>
        <p className="panel-hint">No expeditions in the field. Dispatch one from a province's locations.</p>
      </section>
    )
  }

  return (
    <section className="panel active-expeditions-panel">
      <h2>Active Expeditions</h2>
      <div className="active-mission-list">
        {expeditions.map((exp) => {
          const def = getLocationDefFromState(state, exp.targetLocationId) ?? SECT_SITE_DEFS.find((s) => s.id === exp.targetLocationId)
          const names = exp.discipleIds
            .map((id) => state.disciples.find((d) => d.id === id)?.name)
            .filter((n): n is string => n !== undefined)
          const remaining = Math.max(0, exp.phaseEndsAt - Date.now())

          return (
            <div className="active-mission-card" key={exp.id}>
              <div className="active-mission-header">
                <strong>{def?.name ?? 'Unknown location'}</strong>
                <span>
                  {PHASE_LABEL[exp.phase]} &middot; {formatCountdown(remaining)}
                </span>
              </div>
              <p className="panel-hint">
                Party: {names.join(', ')}
                {exp.purpose === 'gather' ? ` · cycles ${exp.cyclesCompleted}/${exp.cycleTarget}` : ''}
              </p>
              <p className="panel-hint">
                {exp.purpose === 'gather'
                  ? `Accrued: ${payloadLine(exp)}`
                  : exp.purpose === 'claim'
                    ? 'Resolving claim'
                    : exp.purpose === 'raid'
                      ? 'Raiding'
                      : 'Surveying'}
              </p>
              {exp.phase !== 'returning' && (
                <button onClick={() => recallExpedition(exp.id)}>Recall</button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
