import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    globals: false,
    setupFiles: ['./test/setup.ts'],
    css: false,
  },
})
