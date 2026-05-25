import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { pool } from '../db.js'
import { notifyLead } from '../mailer.js'

/* schemas — espelham a validação do frontend, são source of truth aqui */

const LeadInput = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'name muito curto')
    .max(80, 'name muito longo')
    .regex(/^[\p{L}\s'.-]+$/u, 'name com caracteres inválidos'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('email inválido')
    .max(120, 'email muito longo'),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(
      z
        .string()
        .min(10, 'phone deve ter 10–11 dígitos')
        .max(11, 'phone deve ter 10–11 dígitos')
        .regex(/^[1-9][1-9]\d+$/, 'DDD inválido'),
    ),
})

export async function leadRoutes(app: FastifyInstance) {
  app.post('/leads', async (request, reply) => {
    const parse = LeadInput.safeParse(request.body)
    if (!parse.success) {
      const fields = parse.error.flatten().fieldErrors
      return reply.code(400).send({ error: 'invalid_input', fields })
    }
    const { name, email, phone } = parse.data

    const ip =
      (request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        request.ip) ??
      null
    const userAgent = request.headers['user-agent']?.toString() ?? null
    const referer = request.headers.referer?.toString() ?? null

    try {
      const { rows } = await pool.query(
        `INSERT INTO leads (name, email, phone, ip, user_agent, referer)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [name, email, phone, ip, userAgent, referer],
      )

      // fire-and-forget: não bloqueia a resposta para o usuário
      notifyLead({ name, email, phone, ip: ip ?? undefined, userAgent: userAgent ?? undefined })

      return reply.code(201).send({ ok: true, id: rows[0].id })
    } catch (err) {
      request.log.error(err, 'failed to insert lead')
      return reply.code(500).send({ error: 'internal_error' })
    }
  })
}
