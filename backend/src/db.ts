import pg from 'pg'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config, isProd } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  // SSL on em prod por padrão (Railway / managed). Em VPS com Postgres no
  // mesmo Docker network, setar DATABASE_SSL=false desativa.
  ssl: isProd && config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: 5,
})

pool.on('error', (err) => {
  console.error('[db] unexpected pg error', err)
})

/**
 * Aplica migrations SQL em ordem alfabética, registrando o que já rodou
 * em uma tabela _schema_migrations. Idempotente.
 */
export async function runMigrations() {
  const here = dirname(fileURLToPath(import.meta.url))
  const migrationsDir = join(here, '..', 'migrations')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await pool.query(
      'SELECT name FROM _schema_migrations WHERE name = $1',
      [file],
    )
    if (rows.length > 0) continue

    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO _schema_migrations (name) VALUES ($1)',
        [file],
      )
      await client.query('COMMIT')
      console.log(`[db] migration applied: ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`[db] migration failed: ${file}`, err)
      throw err
    } finally {
      client.release()
    }
  }
}
