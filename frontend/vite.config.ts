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
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5267',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5267',
        changeOrigin: true,
      },
      '/hubs': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5267',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
