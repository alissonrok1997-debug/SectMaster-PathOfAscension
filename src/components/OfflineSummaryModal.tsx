import { useGameStore } from '../game/state/store'
import { RESOURCE_LABELS } from '../game/data/resourceLabels'
import { formatDurationAdaptive } from '../game/utils/formatDuration'
import { getMissionDef } from '../game/data/missionDefs'
import { getOutcomeLabel } from '../game/engine/missions'
import { CollapsibleList } from './CollapsibleList'
import type { Resources } from '../game/types'

export function OfflineSummaryModal() {
  const summary = useGameStore((s) => s.offlineSummary)
  const dismiss = useGameStore((s) => s.dismissOfflineSummary)

  if (!summary) return null

  const resourceEntries = Object.entries(summary.resourceGains) as [keyof Resources, number][]
  const hasAnything =
    resourceEntries.length > 0 ||
    summary.buildingsCompleted.length > 0 ||
    summary.discipleBreakthroughs.length > 0 ||
    summary.injuriesRecovered.length > 0 ||
    summary.disciplesReturned.length > 0 ||
    summary.missionOutcomes.length > 0 ||
    summary.itemsCrafted.length > 0 ||
    summary.researchCompleted.length > 0 ||
    summary.techniquesTaught.length > 0 ||
    summary.expeditionsResolved.length > 0 ||
    summary.npcSimResolved.length > 0 ||
    summary.worldEventsResolved.length > 0 ||
    summary.narrativeEventsResolved.length > 0 ||
    summary.loginStreakBonus !== undefined

  return (
    <div className="modal-overlay">
      <div className="modal-panel">
        <h2>Welcome back</h2>
        {summary.elapsedMs > 0 && (
          <p className="panel-hint">
            You were away for {formatDurationAdaptive(summary.elapsedMs / 1000)}
            {summary.wasCapped &&
              ` — capped at ${formatDurationAdaptive(summary.cappedMs / 1000)} (offline cap)`}
            .
          </p>
        )}

        {hasAnything ? (
          <div className="offline-summary-sections">
            {summary.loginStreakBonus && (
              <section>
                <h3>Login Streak</h3>
                <ul>
                  <li>Day {summary.loginStreakBonus.streakDay} in a row</li>
                  {(Object.entries(summary.loginStreakBonus.resourceGains) as [keyof Resources, number][]).map(
                    ([key, amount]) => (
                      <li key={key}>
                        +{amount.toLocaleString()} {RESOURCE_LABELS[key]}
                      </li>
                    ),
                  )}
                </ul>
              </section>
            )}
            {resourceEntries.length > 0 && (
              <section>
                <h3>Resources</h3>
                <CollapsibleList
                  items={resourceEntries.map(([key, amount]) => (
                    <li key={key}>
                      +{Math.floor(amount).toLocaleString()} {RESOURCE_LABELS[key]}
                    </li>
                  ))}
                />
              </section>
            )}
            {summary.buildingsCompleted.length > 0 && (
              <section>
                <h3>Buildings</h3>
                <CollapsibleList
                  items={summary.buildingsCompleted.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                />
              </section>
            )}
            {summary.discipleBreakthroughs.length > 0 && (
              <section>
                <h3>Cultivation</h3>
                <CollapsibleList
                  items={summary.discipleBreakthroughs.map((b, i) => (
                    <li key={i}>
                      {b.name} reached {b.toRealm}
                    </li>
                  ))}
                />
              </section>
            )}
            {summary.missionOutcomes.length > 0 && (
              <section>
                <h3>Missions</h3>
                <CollapsibleList
                  items={summary.missionOutcomes.map((entry) => {
                    const def = getMissionDef(entry.defId)
                    return (
                      <li key={entry.id}>
                        {entry.missionName} &mdash; {getOutcomeLabel(def, entry.outcome)} ({entry.squadNames.join(', ')})
                        {entry.injuries.length > 0 &&
                          ` · ${entry.injuries.map((i) => `${i.name} injured (${i.severity})`).join(', ')}`}
                      </li>
                    )
                  })}
                />
              </section>
            )}
            {summary.itemsCrafted.length > 0 && (
              <section>
                <h3>Crafting</h3>
                <CollapsibleList
                  items={summary.itemsCrafted.map((name, i) => (
                    <li key={i}>{name} finished crafting</li>
                  ))}
                />
              </section>
            )}
            {summary.researchCompleted.length > 0 && (
              <section>
                <h3>Research</h3>
                <CollapsibleList
                  items={summary.researchCompleted.map((name, i) => (
                    <li key={i}>{name} completed</li>
                  ))}
                />
              </section>
            )}
            {summary.techniquesTaught.length > 0 && (
              <section>
                <h3>Techniques</h3>
                <CollapsibleList
                  items={summary.techniquesTaught.map((t, i) => (
                    <li key={i}>
                      {t.discipleName} learned {t.techniqueName}
                    </li>
                  ))}
                />
              </section>
            )}
            {summary.expeditionsResolved.length > 0 && (
              <section>
                <h3>Expeditions</h3>
                <CollapsibleList
                  items={summary.expeditionsResolved.map((entry) => {
                    if (entry.battleResult) {
                      return <li key={entry.id}>{entry.locationName} &mdash; {entry.battleResult.outcomeSummary}</li>
                    }
                    if (entry.purpose === 'survey') {
                      return <li key={entry.id}>{entry.locationName} &mdash; surveyed</li>
                    }
                    if (entry.purpose === 'claim') {
                      return <li key={entry.id}>{entry.locationName} &mdash; outpost established</li>
                    }
                    const gains = (Object.entries(entry.payload.resources) as [keyof Resources, number][])
                      .map(([key, amount]) => `+${Math.floor(amount)} ${RESOURCE_LABELS[key]}`)
                      .join(', ')
                    return (
                      <li key={entry.id}>
                        {entry.locationName} &mdash; {gains || 'no haul'}
                        {entry.incidents.length > 0 && ` · ${entry.incidents.length} incident${entry.incidents.length > 1 ? 's' : ''}`}
                      </li>
                    )
                  })}
                />
              </section>
            )}
            {summary.npcSimResolved.length > 0 && (
              <section>
                <h3>The Wider World</h3>
                <CollapsibleList
                  items={summary.npcSimResolved.map((entry) => (
                    <li key={entry.id}>{entry.text}</li>
                  ))}
                />
              </section>
            )}
            {summary.worldEventsResolved.length > 0 && (
              <section>
                <h3>World Events</h3>
                <CollapsibleList
                  items={summary.worldEventsResolved.map((entry) => (
                    <li key={entry.id}>{entry.name} resolved</li>
                  ))}
                />
              </section>
            )}
            {summary.narrativeEventsResolved.length > 0 && (
              <section>
                <h3>Narrative Events</h3>
                <CollapsibleList
                  items={summary.narrativeEventsResolved.map((entry) => (
                    <li key={entry.id}>{entry.name}</li>
                  ))}
                />
              </section>
            )}
            {summary.injuriesRecovered.length > 0 && (
              <section>
                <h3>Recovery</h3>
                <CollapsibleList
                  items={summary.injuriesRecovered.map((name, i) => (
                    <li key={i}>{name} recovered from injury</li>
                  ))}
                />
              </section>
            )}
            {summary.disciplesReturned.length > 0 && (
              <section>
                <h3>Returned</h3>
                <CollapsibleList
                  items={summary.disciplesReturned.map((name, i) => (
                    <li key={i}>{name} returned to the sect</li>
                  ))}
                />
              </section>
            )}
          </div>
        ) : (
          <p className="panel-hint">Nothing new happened while you were away.</p>
        )}

        <button onClick={dismiss}>Continue</button>
      </div>
    </div>
  )
}
