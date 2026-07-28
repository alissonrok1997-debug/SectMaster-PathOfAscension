import { SAVE_VERSION, type GameState } from '../types'
import { createNewGame } from '../state/initialState'

const STORAGE_KEY = 'sect-master-save'

export function saveGame(state: GameState): void {
  const toStore: GameState = { ...state, lastSavedAt: Date.now() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as GameState
    if (parsed.saveVersion !== SAVE_VERSION) {
      // No migrations exist yet in Wave 0 — start fresh rather than risk
      // hydrating a shape the rest of the app doesn't expect.
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function loadOrCreateGame(): GameState {
  return loadGame() ?? createNewGame()
}
