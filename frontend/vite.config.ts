import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../src/public2',
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
  }
})