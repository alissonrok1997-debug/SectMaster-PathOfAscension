import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './App.css'

/**
 * Offline support for the web build. `autoUpdate` swaps in a new build on the next
 * launch — safe here because the save lives in localStorage, not in the cache, so an
 * update never costs progress.
 *
 * Skipped inside the Android APK: its assets are served from a virtual origin by the
 * WebView, so there is nothing for a service worker to cache and registration would
 * only fail noisily.
 */
if (location.hostname !== 'appassets.local') {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
