import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config, isProd } from './config.js'
import { leadRoutes } from './routes/leads.js'
import { authRoutes } from './auth/routes.js'
import { investigacoesRoutes } from './routes/investigacoes.js'
import { usersRoutes } from './routes/users.js'

/**
 * Constrói a instância Fastify com todas as rotas registradas.
 * Não conecta no DB nem inicia listener — usado tanto pelo server.ts (prod/dev)
 * quanto pelos testes via fastify.inject().
 */
export async function buildApp(
  opts: { logger?: boolean; rateLimit?: boolean } = {},
): Promise<FastifyInstance> {
  const rateLimitEnabled = opts.rateLimit ?? true
  const app = Fastify({
    logger: opts.logger === false
      ? false
      : {
          level: isProd ? 'info' : 'debug',
          transport: isProd
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true } },
        },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  })

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['POST', 'GET', 'OPTIONS'],
    credentials: false,
  })

  if (rateLimitEnabled) {
    await app.register(rateLimit, {
      max: 30,
      timeWindow: '1 minute',
      keyGenerator: (req) =>
        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip,
    })
  }

  app.get('/api/health', async () => ({ ok: true, ts: Date.now() }))

  await app.register(leadRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(investigacoesRoutes, { prefix: '/api' })
  await app.register(usersRoutes, { prefix: '/api' })

  return app
}
