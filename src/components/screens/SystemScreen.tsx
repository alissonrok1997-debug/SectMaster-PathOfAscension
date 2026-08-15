import { SaveControls } from '../SaveControls'
import { DebugPanel } from '../DebugPanel'

export function SystemScreen() {
  return (
    <div className="panel-grid">
      <SaveControls />
      {/*
       * Dev-only. `+200 All Resources` sat beside `Save Now` in the shipped player build,
       * styled identically to it. Vite statically replaces `import.meta.env.DEV` with
       * `false` in a production build, so the whole panel is tree-shaken out rather than
       * merely hidden. `npm run dev` is unchanged.
       */}
      {import.meta.env.DEV && <DebugPanel />}
    </div>
  )
}
