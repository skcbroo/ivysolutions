import { buildApp } from './app.js'
import { bootstrapAdmin } from './auth/bootstrap.js'
import { config } from './config.js'
import { pool, runMigrations } from './db.js'
import { reapOrphanedRuns } from './worker.js'

async function start() {
  const app = await buildApp()

  try {
    await runMigrations()
    await bootstrapAdmin()
    await reapOrphanedRuns()
  } catch (err) {
    app.log.error(err, 'boot failure — aborting')
    process.exit(1)
  }

  const port = config.PORT
  try {
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`IVY backend ouvindo em :${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, async () => {
      app.log.info(`recebido ${sig}, encerrando…`)
      try {
        await app.close()
        await pool.end()
      } finally {
        process.exit(0)
      }
    })
  }
}

start()
