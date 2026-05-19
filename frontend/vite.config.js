import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    open: true,
    // Optional: use VITE_API_URL=/api in .env.local to proxy to local backend
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // "/" so deep links (e.g. /company-portal) on Vercel load JS/CSS from /assets/...
  base: '/',
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})