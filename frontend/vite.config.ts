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
          i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          signalr: ['@microsoft/signalr'],
          icons: ['@phosphor-icons/react'],
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
      '/hubs': {
        target: 'http://localhost:5267',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
