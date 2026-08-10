import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const port = process.env.PORT ? Number(process.env.PORT) : 5173

/**
 * BASE_PATH lets one build serve from a subpath (GitHub Pages: "/SectMaster/") or the
 * root (Netlify/Vercel: "/"). It must match wherever you host, or the service worker
 * and asset URLs 404.
 */
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      // The manifest is generated here rather than kept as a static file, so the icon
      // list and the precache manifest can never drift apart.
      manifest: {
        // Must match scope, or a subpath deploy is treated as a different app on install.
        id: base,
        name: 'Sect Master: Path of Ascension',
        short_name: 'Sect Master',
        description: 'A cultivation-sect idle game. Build your sect, train disciples, claim the First Realm.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#12131a',
        theme_color: '#12131a',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Maskable: safe-zone padded so Android can crop to a circle/squircle.
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The whole game is client-side, so precaching everything makes it fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port,
    strictPort: true,
  },
})
