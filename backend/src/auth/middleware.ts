import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyToken, type JwtPayload } from './jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ error: 'missing_token' })
  }
  const token = header.slice(7).trim()
  try {
    request.user = verifyToken(token)
  } catch {
    return reply.code(401).send({ error: 'invalid_token' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (request.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'admin_required' })
  }
}
