import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.png'],
      manifest: {
        name: 'Shark Green App',
        short_name: 'SharkGreen',
        description: 'Procedimentos e sinais de apostas esportivas em tempo real',
        theme_color: '#0d2b1a',
        background_color: '#0a1f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/',
        scope: '/app/',
        lang: 'pt-BR',
        icons: [
          { src: '/app/icons/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/app/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: [],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src'), '@assets': path.resolve(__dirname, '../attached_assets') },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
})
