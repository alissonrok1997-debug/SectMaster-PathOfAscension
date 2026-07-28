import { useGameStore } from '../game/state/store'

export function SaveControls() {
  const lastSavedAt = useGameStore((s) => s.state.lastSavedAt)
  const saveNow = useGameStore((s) => s.saveNow)
  const reloadFromSave = useGameStore((s) => s.reloadFromSave)
  const resetSave = useGameStore((s) => s.resetSave)

  const handleReset = () => {
    if (confirm('Reset the save? This clears all progress and starts a fresh Wave 0 shell.')) {
      resetSave()
    }
  }

  return (
    <section className="panel">
      <h2>Save / Load</h2>
      <p className="panel-hint">Autosaves every 10s and on tab close. Persists via localStorage.</p>
      <div className="save-controls-buttons">
        <button onClick={saveNow}>Save Now</button>
        <button onClick={reloadFromSave}>Reload From Save</button>
        <button className="danger" onClick={handleReset}>
          Reset Save
        </button>
      </div>
      <p className="panel-hint">Last saved: {new Date(lastSavedAt).toLocaleTimeString()}</p>
    </section>
  )
}
