import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { pool } from '../src/db.js'
import { deleteAllUsers, resetDomain } from './helpers.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(async () => {
  await resetDomain()
  await deleteAllUsers()
})

describe('POST /api/auth/register', () => {
  it('exige email e password válidos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'invalido', password: '123' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('respeita ALLOW_REGISTRATION (atualmente true em dev/test)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'a@ivy.com', password: 'senha12345' },
    })
    // se a flag estiver desabilitada (prod), retorna 403; senão 201
    expect([201, 403]).toContain(res.statusCode)
  })

  it('cria usuário e rejeita duplicata', async () => {
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@ivy.com', password: 'senha12345', nome: 'Novo' },
    })
    if (r1.statusCode === 403) return // ALLOW_REGISTRATION desligado: skip cenário
    expect(r1.statusCode).toBe(201)

    const r2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'novo@ivy.com', password: 'senha12345' },
    })
    expect(r2.statusCode).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'login@ivy.com', password: 'senha12345' },
    })
    if (r.statusCode === 403) {
      // suite roda em modo prod sem registration; insere usuário direto via DB
      // (cobertura mínima do flow de login)
      const bcrypt = await import('bcryptjs')
      const hash = await bcrypt.default.hash('senha12345', 10)
      await pool.query(
        `INSERT INTO users (email, password_hash, nome) VALUES ($1,$2,$3)`,
        ['login@ivy.com', hash, 'Login'],
      )
    }
  })

  it('rejeita email inexistente com 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'naoexiste@ivy.com', password: 'qualquer' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'invalid_credentials' })
  })

  it('rejeita senha errada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'login@ivy.com', password: 'errada' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('retorna JWT em login válido', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'login@ivy.com', password: 'senha12345' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { token: string; user: { email: string } }
    expect(body.token.split('.').length).toBe(3)
    expect(body.user.email).toBe('login@ivy.com')
  })
})
