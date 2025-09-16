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
  // Handle client-side routing for production builds
  base: './',
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})