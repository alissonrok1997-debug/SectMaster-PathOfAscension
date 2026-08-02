import { SaveControls } from '../SaveControls'
import { DebugPanel } from '../DebugPanel'

export function SystemScreen() {
  return (
    <div className="panel-grid">
      <SaveControls />
      <DebugPanel />
    </div>
  )
}
