import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  build: {
    outDir: '../src/public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:6600',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:6600',
        changeOrigin: true,
        ws: true
      },
      '/manifest.json': {
        target: 'http://localhost:6600',
        changeOrigin: true
      }
    }
  },
  // Add SPA fallback for routing
  appType: 'spa'
})