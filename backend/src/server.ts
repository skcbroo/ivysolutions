import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config, isProd } from './config.js'
import { pool, runMigrations } from './db.js'
import { leadRoutes } from './routes/leads.js'

async function start() {
  const app = Fastify({
    logger: {
      level: isProd ? 'info' : 'debug',
      transport: isProd
        ? undefined
        : { target: 'pino-pretty', options: { colorize: true } },
    },
    trustProxy: true,
    bodyLimit: 32 * 1024, // 32 KB — payload do form é minúsculo
  })

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['POST', 'GET', 'OPTIONS'],
    credentials: false,
  })

  await app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (req) =>
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip,
  })

  app.get('/api/health', async () => ({ ok: true, ts: Date.now() }))

  await app.register(leadRoutes, { prefix: '/api' })

  try {
    await runMigrations()
  } catch (err) {
    app.log.error(err, 'migration failure — aborting')
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
