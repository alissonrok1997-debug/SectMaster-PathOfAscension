import { useEffect, useRef } from 'react'
import { useGameStore } from '../game/state/store'

const TICK_INTERVAL_MS = 250
const AUTOSAVE_INTERVAL_MS = 10_000

/**
 * Lives in `components/`, not `engine/`: this is a React hook that DRIVES the engine, not engine
 * code itself. `engine/` and `data/` must stay importable by a Node server (MULTIPLAYER_PLAN §4),
 * and `npm run engine-purity` fails the moment anything in there reaches for React or the DOM.
 *
 * Drives the Simulation Clock forward using real elapsed time (Date.now()
 * deltas, not a fixed step count), autosaves periodically, and saves once
 * more on unload so closing the tab never loses progress.
 *
 * Uses setInterval rather than requestAnimationFrame: rAF fully stops when
 * the tab isn't visible/compositing, which is wrong for an idle game that
 * should keep progressing in a backgrounded tab. setInterval keeps firing
 * (just throttled by the browser), and since the tick amount is computed
 * from a real Date.now() delta rather than assumed to be TICK_INTERVAL_MS,
 * throttling only makes updates chunkier, never inaccurate.
 */
export function useGameLoop() {
  const tick = useGameStore((s) => s.tick)
  const saveNow = useGameStore((s) => s.saveNow)
  const lastTickRef = useRef(Date.now())

  useEffect(() => {
    lastTickRef.current = Date.now()

    const interval = setInterval(() => {
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      tick(delta)
    }, TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [tick])

  useEffect(() => {
    const autosave = setInterval(saveNow, AUTOSAVE_INTERVAL_MS)
    const handleUnload = () => saveNow()
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      clearInterval(autosave)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [saveNow])
}
