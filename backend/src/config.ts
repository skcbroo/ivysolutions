import { z } from 'zod'

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // SMTP (Gmail). Em dev, se nada estiver setado, o email é apenas logado.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  LEAD_TO_EMAIL: z.string().email().optional(),
  LEAD_FROM_EMAIL: z.string().email().optional(),

  // OSINT / auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 chars').optional(),
  JWT_TTL: z.string().default('30d'),
  ALLOW_REGISTRATION: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  DATAJUD_API_KEY: z.string().optional(),

  // Bootstrap inicial: se nenhum admin ativo existir no DB, cria um a partir
  // destas vars (no boot do server). Idempotente: rodadas posteriores são no-op.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NOME: z.string().optional(),
})

const parsed = Env.safeParse(process.env)
if (!parsed.success) {
  console.error('[config] invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data
const isProdEnv = env.NODE_ENV === 'production'

if (!env.JWT_SECRET) {
  if (isProdEnv) {
    console.error('[config] JWT_SECRET é obrigatório em produção')
    process.exit(1)
  }
  env.JWT_SECRET = 'dev-secret-change-me-please-32ch!'
}

export const config = env as typeof env & { JWT_SECRET: string }
export const isProd = isProdEnv
