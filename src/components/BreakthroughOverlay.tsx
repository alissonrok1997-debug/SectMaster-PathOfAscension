import { useEffect, useRef, useState } from 'react'
import { subscribeToBreakthroughMoment, type BreakthroughOutcome } from './breakthroughChannel'

/** Success is a beat; failure needs reading time — §16.3's ≤1.2s cap is a success constraint. */
const HOLD_MS: Record<BreakthroughOutcome['kind'], number> = {
  success: 1200,
  failure: 1600,
  tally: 2400,
}

const CONSEQUENCE_LINE: Record<'wound' | 'downed' | 'death', (name: string) => string> = {
  wound: (name) => `${name} takes a major wound.`,
  downed: (name) => `${name} is Downed.`,
  death: (name) => `${name} does not survive.`,
}

/**
 * The breakthrough moment (§16.3) — the game's central fantasy, and the one place §12's
 * "one overlay pattern" rule permits something other than a `BottomSheet`: a full-screen
 * narrative modal.
 *
 * Mounted from `App`, not from the detail sheet: `sheet-rise` animates a transform, which
 * creates a containing block and would clip a `position: fixed` child.
 *
 * Every variant is tap-dismissible and auto-dismisses. It reports, it never decides —
 * the engine has already resolved the outcome by the time this renders.
 */
export function BreakthroughOverlay() {
  const [outcome, setOutcome] = useState<BreakthroughOutcome | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return subscribeToBreakthroughMoment((next) => {
      window.clearTimeout(timer.current)
      setOutcome(next)
      timer.current = window.setTimeout(() => setOutcome(null), HOLD_MS[next.kind])
    })
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!outcome) return null

  const dismiss = () => {
    window.clearTimeout(timer.current)
    setOutcome(null)
  }

  return (
    <div className={`breakthrough-moment ${outcome.kind}`} onClick={dismiss} role="presentation">
      {outcome.kind === 'success' && (
        <>
          {/* Jade bloom from centre. No verb and no "Congratulations" — the realm name is the news. */}
          <div className="breakthrough-bloom" aria-hidden="true" />
          <p className="breakthrough-realm-name">{outcome.realm}</p>
          <p className="breakthrough-moment-sub">{outcome.name}</p>
        </>
      )}

      {outcome.kind === 'failure' && (
        <>
          {/* Ash wash that contracts instead of blooming — the inverse gesture of success.
              A screen-wide filter: saturate() reads as nothing on a palette this dark. */}
          <div className="breakthrough-ash" aria-hidden="true" />
          <p className="breakthrough-fail-title">The breakthrough fails</p>
          <p className="breakthrough-fail-line">{CONSEQUENCE_LINE[outcome.consequence](outcome.name)}</p>
        </>
      )}

      {outcome.kind === 'tally' && (
        <>
          {/* No bloom: one verdict over several mixed outcomes would be a lie. */}
          <p className="breakthrough-fail-title tally-title">The sect attempts ascension</p>
          <ul className="breakthrough-tally">
            {outcome.results.map((r) => (
              <li key={r.name}>
                <span className="tally-name">{r.name}</span>
                {r.realm ? (
                  <span className="tally-good">ascends to {r.realm}</span>
                ) : (
                  <span className="tally-bad">
                    {r.consequence === 'death'
                      ? 'does not survive'
                      : r.consequence === 'downed'
                        ? 'fails — Downed'
                        : 'fails — a major wound'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
