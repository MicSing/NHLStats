import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          recharts: ['recharts'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5267',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5267',
        changeOrigin: true,
      },
    },
  },
})
