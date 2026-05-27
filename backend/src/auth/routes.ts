import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { config } from '../config.js'
import { DEFAULT_PASSWORD, hashPassword, verifyPassword } from './hash.js'
import { signToken } from './jwt.js'
import { requireAuth } from './middleware.js'
import * as usersRepo from '../repos/users.js'

const RegisterInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(200),
  nome: z.string().trim().min(2).max(120).optional(),
})

const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(1).max(200),
})

const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Nova senha precisa ter ao menos 8 caracteres.').max(200),
})

export async function authRoutes(app: FastifyInstance) {
  // ─── Registro inicial gated (bootstrap) ─────────────────────────────────
  app.post('/auth/register', async (request, reply) => {
    if (!config.ALLOW_REGISTRATION) {
      return reply.code(403).send({ error: 'registration_disabled' })
    }
    const parse = RegisterInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input', fields: parse.error.flatten().fieldErrors })
    }
    const { email, password, nome } = parse.data
    const hash = await hashPassword(password)
    try {
      const user = await usersRepo.create({
        email,
        passwordHash: hash,
        nome: nome ?? null,
      })
      return reply.code(201).send(user)
    } catch (err: unknown) {
      if (err instanceof Error && /duplicate key/i.test(err.message)) {
        return reply.code(409).send({ error: 'email_already_registered' })
      }
      request.log.error(err, 'failed to register user')
      return reply.code(500).send({ error: 'internal_error' })
    }
  })

  // ─── Login ──────────────────────────────────────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const parse = LoginInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input' })
    }
    const { email, password } = parse.data
    const user = await usersRepo.findByEmail(email)
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' })
    if (!user.active) return reply.code(403).send({ error: 'user_inactive' })
    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' })

    const role = user.role === 'admin' ? 'admin' : 'analista'
    const token = signToken({ userId: user.id, email: user.email, role })
    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role,
        must_change_password: user.must_change_password,
      },
    })
  })

  // ─── Sessão atual ───────────────────────────────────────────────────────
  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user?.userId
    if (userId === undefined) return reply.code(404).send({ error: 'not_found' })
    const user = await usersRepo.findById(userId)
    if (!user) return reply.code(404).send({ error: 'not_found' })
    return user
  })

  // ─── Trocar a própria senha ─────────────────────────────────────────────
  app.post('/auth/me/password', { preHandler: requireAuth }, async (request, reply) => {
    const parse = ChangePasswordInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input', fields: parse.error.flatten().fieldErrors })
    }
    const { currentPassword, newPassword } = parse.data
    const userId = request.user?.userId
    if (userId === undefined) return reply.code(404).send({ error: 'not_found' })
    const currentHash = await usersRepo.findPasswordHashById(userId)
    if (currentHash === null) return reply.code(404).send({ error: 'not_found' })
    const ok = await verifyPassword(currentPassword, currentHash)
    if (!ok) return reply.code(401).send({ error: 'wrong_current_password' })

    if (newPassword === currentPassword) {
      return reply.code(400).send({ error: 'same_password' })
    }
    if (newPassword === DEFAULT_PASSWORD) {
      return reply.code(400).send({ error: 'cannot_use_default_password' })
    }

    const newHash = await hashPassword(newPassword)
    await usersRepo.setPassword(userId, newHash, false)
    return { ok: true }
  })
}
