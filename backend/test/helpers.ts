import type { FastifyInstance } from 'fastify'
import { pool } from '../src/db.js'

/** Limpa tabelas de domínio antes de cada teste, sem dropar usuários. */
export async function resetDomain() {
  await pool.query(`TRUNCATE investigacoes RESTART IDENTITY CASCADE`)
}

/** Remove todos os usuários (uso em afterAll de auth tests). */
export async function deleteAllUsers() {
  await pool.query(`TRUNCATE users RESTART IDENTITY CASCADE`)
}

export async function registerAndLogin(
  app: FastifyInstance,
  email = 'tester@ivy.com',
  password = 'senha12345',
): Promise<{ token: string; userId: number }> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password, nome: 'Tester' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  })
  const body = res.json() as { token: string; user: { id: number } }
  return { token: body.token, userId: body.user.id }
}
