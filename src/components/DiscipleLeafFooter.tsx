import { useGameStore } from '../game/state/store'
import { getBreakthroughEligibility, isReadyForBreakthrough } from '../game/engine/cultivation'
import { getInjurySeverity } from '../game/engine/injury'
import { isDowned } from '../game/engine/downed'
import { publishBreakthroughMoment } from './breakthroughChannel'
import type { DiscipleInstance } from '../game/types'

/**
 * Does this disciple have a footer action right now?
 *
 * Exported so `DiscipleDetailModal` can decide whether to pass a `footer` at all. It cannot
 * just pass `<DiscipleLeafFooter/>` and let it return null: `BottomSheet` guards on
 * `{footer && ...}`, and a React element that renders nothing is still truthy — the sheet
 * would draw an empty bar with its top rule and padding, permanently, on every disciple who
 * is not at the gate.
 */
export function hasLeafFooterAction(disciples: DiscipleInstance[], discipleId: string): boolean {
  const disciple = disciples.find((d) => d.id === discipleId)
  return disciple ? isReadyForBreakthrough(disciple) : false
}

/**
 * THE ONE ACTION. §12: "Footer holds exactly one primary action." §16.3: the risk is stated in
 * plain language above it, never in a tooltip, and the numbers leave the button so the button
 * can say one thing.
 *
 * Breakthrough only — the Cultivation Boost stays in the body beside the Posting row it
 * depends on. Promoting it here as a fallback was the plan, and it was wrong twice over: it
 * would have put a second action in a slot §12 reserves for one, and on a disciple who is both
 * ready AND posted to the Training Ground it would have had to suppress one of them, removing
 * an action the player can reach today.
 *
 * The breakthrough handler moves here wholesale, snapshot and all. §23 records why it works
 * this way: `attemptBreakthrough` is a synchronous zustand action, so the handler snapshots the
 * realm, runs it, re-reads `getState()` and publishes the difference over a one-slot module
 * channel — a 1.2-second overlay does not deserve a store field and a save-format question.
 * A disciple missing from the post-action roster is not an error: a failed breakthrough wounds,
 * and a wound can kill.
 */
export function DiscipleLeafFooter({ discipleId }: { discipleId: string }) {
  const state = useGameStore((s) => s.state)
  const attemptBreakthrough = useGameStore((s) => s.attemptBreakthrough)

  const disciple = state.disciples.find((d) => d.id === discipleId)
  if (!disciple || !isReadyForBreakthrough(disciple)) return null

  const eligibility = getBreakthroughEligibility(state, disciple.id)
  const isCritical = getInjurySeverity(disciple) === 'critical'

  const onAttempt = () => {
    const before = { name: disciple.name, realm: disciple.realm }
    attemptBreakthrough(disciple.id)
    const after = useGameStore.getState().state.disciples.find((d) => d.id === disciple.id)
    if (!after) {
      publishBreakthroughMoment({ kind: 'failure', name: before.name, consequence: 'death' })
      return
    }
    if (after.realm !== before.realm) {
      publishBreakthroughMoment({ kind: 'success', name: after.name, realm: after.realm })
      return
    }
    publishBreakthroughMoment({
      kind: 'failure',
      name: after.name,
      consequence: isDowned(after, Date.now()) ? 'downed' : 'wound',
    })
  }

  return (
    <>
      <p className="breakthrough-risk">
        {eligibility.cost} Qi Stone. {Math.round(eligibility.successChance * 100)}% chance to succeed.
      </p>
      <p className={`breakthrough-risk-warning${isCritical ? ' grave' : ''}`}>
        {isCritical
          ? `If it fails: a major wound. At this condition it could kill ${disciple.name}.`
          : 'If it fails: a major wound, and the stage falls back.'}
      </p>
      <button className="primary" disabled={!eligibility.canBreakthrough} onClick={onAttempt}>
        Attempt the breakthrough
      </button>
      {!eligibility.canBreakthrough && eligibility.reason && (
        <p className="upgrade-blocked-reason">{eligibility.reason}</p>
      )}
    </>
  )
}
