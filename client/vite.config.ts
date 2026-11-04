import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // 'autoUpdate': a new deployed build replaces the cached one silently
        // on next load — no stale-version prompt to build/wire up, and no
        // risk of someone getting stuck on an old cached build indefinitely.
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Valtireo',
          short_name: 'Valtireo',
          description: 'Valtireo — the organizational OS for people, requests, and decisions.',
          theme_color: '#123F3A',
          background_color: '#F7FAF9',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        // Workbox needs this disabled in dev — otherwise its injected manifest
        // self-check fails against Vite's dev-server virtual modules and the
        // plugin throws on every cold start of `npm run dev`.
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        // Forwards /api/* to the local Laravel backend so the browser never
        // has to deal with cross-origin requests during development.
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // Public-disk files (photos, logos) — assetUrl() rewrites their
        // absolute backend URL down to a relative /storage/* path in dev,
        // which this proxy then forwards the same way /api already is.
        '/storage': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
