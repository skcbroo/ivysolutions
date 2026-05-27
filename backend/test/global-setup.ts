import { pool, runMigrations } from '../src/db.js'

/**
 * Vitest globalSetup: roda uma única vez antes de TODOS os arquivos de teste
 * (incluindo workers em paralelo). Aplica migrations e fecha o pool no teardown.
 */
export async function setup() {
  await runMigrations()
}

export async function teardown() {
  await pool.end()
}
