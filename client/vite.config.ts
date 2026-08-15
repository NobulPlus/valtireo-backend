import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forwards /api/* to the local Laravel backend so the browser never
      // has to deal with cross-origin requests during development.
      '/api': {
        target: 'http://valtireo.test',
        changeOrigin: true,
      },
    },
  },
})
