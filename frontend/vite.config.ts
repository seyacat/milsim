import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../src/public',
    emptyOutDir: true
  },
  server: {
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'cert.key')),
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.crt')),
    },
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