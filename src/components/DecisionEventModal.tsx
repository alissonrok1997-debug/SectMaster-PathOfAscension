import { useGameStore } from '../game/state/store'
import { getEventDef } from '../game/data/eventDefs'
import { BottomSheet } from './BottomSheet'

/** A decision must be answered — there is no dismiss path. */
const NO_DISMISS = () => {}

/** Reuses OfflineSummaryModal's overlay/panel pattern. "Paused until the player returns" (doc 05 §2) means the sim keeps ticking underneath — only the next narrative event roll waits — while this stays on screen. */
export function DecisionEventModal() {
  const pending = useGameStore((s) => s.state.pendingEvent)
  const resolveEventChoice = useGameStore((s) => s.resolveEventChoice)

  if (!pending) return null
  const def = getEventDef(pending.defId)
  if (def.kind !== 'decision' || !def.choices) return null

  return (
    <BottomSheet open onClose={NO_DISMISS} title={def.name} dismissible={false}>
      <p className="panel-hint">{def.text}</p>
      <div className="decision-event-choices">
        {def.choices.map((choice, index) => (
          <button className="decision-event-choice" key={choice.label} onClick={() => resolveEventChoice(index)}>
            {choice.label}
            <span className="decision-event-choice-description">{choice.description}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
