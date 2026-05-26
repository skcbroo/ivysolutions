import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 30_000,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true }, // testes E2E compartilham DB
    },
    sequence: { hooks: 'list' },
    globalSetup: ['./test/global-setup.ts'],
  },
})
