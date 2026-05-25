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
})

const parsed = Env.safeParse(process.env)
if (!parsed.success) {
  console.error('[config] invalid environment:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
export const isProd = config.NODE_ENV === 'production'
