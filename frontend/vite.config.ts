import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  server: {
    host: true,
    port: 5173,
    proxy: {
      // /api/* é proxied para o backend Fastify em dev
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },

  preview: { host: true, port: 4173 },

  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 800, // three.js sozinho cabe nesse teto
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'three'
            if (
              id.includes('@react-three') ||
              id.includes('zustand') ||
              id.includes('its-fine')
            )
              return 'r3f'
            if (id.includes('react-router')) return 'router'
            if (id.includes('react')) return 'react'
          }
        },
      },
    },
  },
})
