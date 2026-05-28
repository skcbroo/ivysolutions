import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { DEFAULT_PASSWORD, hashPassword } from '../auth/hash.js'
import { requireAdmin } from '../auth/middleware.js'
import * as usersRepo from '../repos/users.js'

const CreateUserInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  nome: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'analista']).default('analista'),
})

const PatchUserInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120).optional(),
  nome: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['admin', 'analista']).optional(),
  active: z.boolean().optional(),
})

function isDuplicateKey(err: unknown): boolean {
  return err instanceof Error && /duplicate key/i.test(err.message)
}

export async function usersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin)

  // ─── Listar usuários ────────────────────────────────────────────────────
  app.get('/users', async () => {
    return await usersRepo.listAll()
  })

  // ─── Criar usuário com senha padrão ─────────────────────────────────────
  app.post('/users', async (request, reply) => {
    const parse = CreateUserInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input', fields: parse.error.flatten().fieldErrors })
    }
    const { email, nome, role } = parse.data
    const hash = await hashPassword(DEFAULT_PASSWORD)
    try {
      const user = await usersRepo.create({
        email,
        passwordHash: hash,
        nome,
        role,
        mustChangePassword: true,
      })
      return reply.code(201).send({ ...user, default_password: DEFAULT_PASSWORD })
    } catch (err: unknown) {
      if (isDuplicateKey(err)) {
        return reply.code(409).send({ error: 'email_already_registered' })
      }
      request.log.error(err, 'failed to create user')
      return reply.code(500).send({ error: 'internal_error' })
    }
  })

  // ─── Editar usuário ─────────────────────────────────────────────────────
  app.patch<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' })

    const parse = PatchUserInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input', fields: parse.error.flatten().fieldErrors })
    }
    const { email, nome, role, active } = parse.data
    const self = request.user?.userId

    // Salvaguardas críticas
    if (active === false && self === id) {
      return reply.code(400).send({ error: 'cannot_deactivate_self' })
    }
    if (role === 'analista' && self === id) {
      return reply.code(400).send({ error: 'cannot_demote_self' })
    }

    // Existe ao menos 1 admin ativo depois desta operação?
    if (role === 'analista' || active === false) {
      const target = await usersRepo.getRoleAndActive(id)
      if (!target) return reply.code(404).send({ error: 'not_found' })
      const wouldBecome = {
        role: role ?? target.role,
        active: active ?? target.active,
      }
      if (target.role === 'admin' && target.active && !(wouldBecome.role === 'admin' && wouldBecome.active)) {
        const remaining = await usersRepo.countActiveAdmins(id)
        if (remaining === 0) {
          return reply.code(400).send({ error: 'last_admin_protected' })
        }
      }
    }

    try {
      const updated = await usersRepo.updatePartial(id, { email, nome, role, active })
      if (updated === null) {
        // Sem campos: nothing_to_update. updatePartial retorna null em ambos
        // os casos (sem campos OU id não encontrado), então desambiguamos.
        if (email === undefined && nome === undefined && role === undefined && active === undefined) {
          return reply.code(400).send({ error: 'nothing_to_update' })
        }
        return reply.code(404).send({ error: 'not_found' })
      }
      return updated
    } catch (err: unknown) {
      if (isDuplicateKey(err)) {
        return reply.code(409).send({ error: 'email_already_registered' })
      }
      request.log.error(err, 'failed to patch user')
      return reply.code(500).send({ error: 'internal_error' })
    }
  })

  // ─── Reset de senha ─────────────────────────────────────────────────────
  app.post<{ Params: { id: string } }>('/users/:id/reset-password', async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' })

    const hash = await hashPassword(DEFAULT_PASSWORD)
    const ok = await usersRepo.setPassword(id, hash, true)
    if (!ok) return reply.code(404).send({ error: 'not_found' })
    return { ok: true, default_password: DEFAULT_PASSWORD }
  })
}
