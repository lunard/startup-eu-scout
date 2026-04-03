import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'EU Scout',
        short_name: 'EU Scout',
        description: 'AI-powered EU funding scouting for startups',
        theme_color: '#0A1628',
        background_color: '#0A1628',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api/eu': {
        target: 'https://api.tech.ec.europa.eu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eu/, ''),
      },
      '/api/opencorporates': {
        target: 'https://api.opencorporates.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opencorporates/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'motion': ['framer-motion'],
          'query': ['@tanstack/react-query'],
          'storage': ['dexie'],
        },
      },
    },
  },
})
