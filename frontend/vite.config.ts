import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
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
  }
})