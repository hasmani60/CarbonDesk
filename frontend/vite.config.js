import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    open: true, // Automatically open browser
    // Enable client-side routing fallback
    historyApiFallback: true,
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