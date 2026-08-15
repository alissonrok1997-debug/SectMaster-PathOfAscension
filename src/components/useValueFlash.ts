import { useEffect, useRef, useState } from 'react'

/** §17 item 1: the flash returns over ~1.2s. Loss is shorter — a spend is acknowledged, not admired. */
const GAIN_MS = 1200
const LOSS_MS = 600

/**
 * Samples further apart than this are not a player action: a backgrounded tab catching up, or
 * offline progress being applied, both arrive as one enormous lump. The loop ticks every
 * 250ms, so no real action takes more than a few ticks to render.
 */
const MAX_SAMPLE_GAP_MS = 1000

/**
 * Value-change flash (§17 item 1) — the cheapest game-feel win in the game, and the easiest
 * to get wrong.
 *
 * **The trap:** this is an idle game. Production is added every 250ms tick, so a naive
 * "flash on increase" latches permanently on and turns `--positive` — which also means health
 * and success — into wallpaper. So the two directions are treated asymmetrically:
 *
 * - **Losses are never gated.** Passive income cannot decrease a resource, so any decrease is
 *   discrete and player-caused.
 * - **Gains are gated by a caller-supplied threshold.** `ResourceBar` measures it against the
 *   *storage cap*, not the current value: a value-relative threshold collapses along with the
 *   value after a big spend, at which point a late-game drip clears it every tick and latches.
 *
 * Pure presentation — resource deltas are not recorded anywhere in state, so this diffs what
 * it renders and touches no engine, store or save code.
 */
export function useValueFlash<K extends string>(
  values: Record<K, number>,
  /** Minimum increase that counts as an event rather than the idle drip. */
  gainThreshold: (key: K) => number,
  /** Suppress the gain flash entirely — `ResourceBar` uses it so a capped resource stays red. */
  suppressGain?: (key: K) => boolean,
): Partial<Record<K, string>> {
  const previous = useRef<Partial<Record<K, number>>>({})
  const sampledAt = useRef(0)
  /** CSS animations don't restart on re-adding the same class, so events alternate a/b. */
  const alternate = useRef<Partial<Record<K, boolean>>>({})
  const timers = useRef<Partial<Record<K, number>>>({})
  const [flash, setFlash] = useState<Partial<Record<K, string>>>({})

  // Deliberately runs on every render: the store re-renders each tick, and that *is* the
  // sampling clock. There is no dependency array that would be more correct here.
  useEffect(() => {
    const now = Date.now()
    const firstSample = sampledAt.current === 0
    const gap = now - sampledAt.current
    sampledAt.current = now

    const started: Partial<Record<K, string>> = {}
    for (const key of Object.keys(values) as K[]) {
      const before = previous.current[key]
      previous.current[key] = values[key]
      if (firstSample || before === undefined || gap > MAX_SAMPLE_GAP_MS) continue

      const delta = values[key] - before
      const kind = delta < 0 ? 'loss' : delta >= gainThreshold(key) && !suppressGain?.(key) ? 'gain' : undefined
      if (!kind) continue
      /*
       * A gain never re-triggers while one is still playing, so the flash can pulse at worst
       * and never sit solid. This is the backstop for the one pathological case a 2%-of-cap
       * threshold can't cover on its own — a very small cap combined with very large income,
       * where a single tick's drip clears the threshold. (In practice such a resource is
       * pinned at cap, and the at-cap suppression above already silences it.) Losses may
       * re-trigger: consecutive spends are deliberate, and each deserves its acknowledgement.
       */
      if (kind === 'gain' && flash[key]) continue

      alternate.current[key] = !alternate.current[key]
      started[key] = `flash-${kind}-${alternate.current[key] ? 'a' : 'b'}`
      window.clearTimeout(timers.current[key])
      timers.current[key] = window.setTimeout(
        () =>
          setFlash((current) => {
            if (!(key in current)) return current
            const next = { ...current }
            delete next[key]
            return next
          }),
        kind === 'gain' ? GAIN_MS : LOSS_MS,
      )
    }

    if (Object.keys(started).length > 0) setFlash((current) => ({ ...current, ...started }))
  })

  useEffect(() => {
    const live = timers.current
    return () => {
      for (const id of Object.values(live) as number[]) window.clearTimeout(id)
    }
  }, [])

  return flash
}
