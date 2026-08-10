import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './App.css'

/**
 * Offline support. `autoUpdate` swaps in a new build on the next launch — safe here
 * because the save lives in localStorage, not in the cache, so an update never costs
 * progress.
 */
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
