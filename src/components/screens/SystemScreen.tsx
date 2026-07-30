import { SaveControls } from '../SaveControls'
import { DebugPanel } from '../DebugPanel'
import { WorldDebugPanel } from '../WorldDebugPanel'

export function SystemScreen() {
  return (
    <div className="panel-grid">
      <SaveControls />
      <DebugPanel />
      <WorldDebugPanel />
    </div>
  )
}
