import { z } from 'zod'

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  // SSL no Postgres: padrão true em produção (Railway/managed). Em VPS com
  // Postgres no mesmo Docker network, defina DATABASE_SSL=false.
  DATABASE_SSL: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // SMTP (Gmail). Em dev, se nada estiver setado, o email é apenas logado.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Aceita um ou mais destinatários separados por vírgula.
  LEAD_TO_EMAIL: z
    .string()
    .optional()
    .refine(
      (v) =>
        v === undefined ||
        v.split(',').every((e) => z.string().email().safeParse(e.trim()).success),
      'LEAD_TO_EMAIL: lista de e-mails inválida',
    ),
  LEAD_FROM_EMAIL: z.string().email().optional(),

  // OSINT / auth
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter pelo menos 16 chars').optional(),
  JWT_TTL: z.string().default('30d'),
  ALLOW_REGISTRATION: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),

  // Block 3: análise de comunicados via Claude. Atrás de flag.
  BLOCK3_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default('claude-haiku-4-5'),

  // Block 4: buscas internacionais (OpenSanctions + scraping). Atrás de flag.
  BLOCK4_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  OPENSANCTIONS_API_KEY: z.string().optional(),
  UK_COMPANIES_API_KEY: z.string().optional(),

  // Bootstrap inicial: se nenhum admin ativo existir no DB, cria um a partir
  // destas vars (no boot do server). Idempotente: rodadas posteriores são no-op.
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NOME: z.string().optional(),
})

// Strings vazias (ex.: `SMTP_PORT: ${SMTP_PORT}` no compose com a var ausente
// no .env) viram "" no container. Tratamos "" como ausente para não quebrar
// validações .optional() (.email(), coerce number, etc).
const rawEnv: Record<string, string | undefined> = {}
for (const [k, v] of Object.entries(process.env)) {
  rawEnv[k] = v === '' ? undefined : v
}

const parsed = Env.safeParse(rawEnv)
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
