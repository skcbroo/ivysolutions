import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { pool } from '../src/db.js'
import { DEFAULT_PASSWORD, hashPassword } from '../src/auth/hash.js'
import { signToken } from '../src/auth/jwt.js'
import { deleteAllUsers, resetDomain } from './helpers.js'

let app: FastifyInstance
let adminToken: string
let adminId: number
let analystToken: string
let analystId: number

async function seedUser(email: string, password: string, role: 'admin' | 'analista' = 'analista') {
  const hash = await hashPassword(password)
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, nome, role, active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [email, hash, email.split('@')[0], role],
  )
  return Number(rows[0].id)
}

beforeAll(async () => {
  app = await buildApp({ logger: false, rateLimit: false })
  await app.ready()
})
afterAll(async () => app.close())

beforeEach(async () => {
  await resetDomain()
  await deleteAllUsers()
  adminId = await seedUser('admin@ivy.com', 'adminpass', 'admin')
  analystId = await seedUser('analyst@ivy.com', 'analystpass', 'analista')
  adminToken = signToken({ userId: adminId, email: 'admin@ivy.com', role: 'admin' })
  analystToken = signToken({ userId: analystId, email: 'analyst@ivy.com', role: 'analista' })
})

describe('GET /api/auth/me', () => {
  it('retorna usuário atual completo', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body).toMatchObject({
      id: adminId,
      email: 'admin@ivy.com',
      role: 'admin',
      active: true,
    })
  })
  it('401 sem token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/me/password', () => {
  it('troca senha quando current bate', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { currentPassword: 'analystpass', newPassword: 'novaSenha123' },
    })
    expect(res.statusCode).toBe(200)
    // login com nova senha funciona
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analyst@ivy.com', password: 'novaSenha123' },
    })
    expect(login.statusCode).toBe(200)
  })
  it('rejeita senha atual errada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { currentPassword: 'errada', newPassword: 'novaSenha123' },
    })
    expect(res.statusCode).toBe(401)
  })
  it('rejeita usar a senha padrão como nova', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { currentPassword: 'analystpass', newPassword: DEFAULT_PASSWORD },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'cannot_use_default_password' })
  })
  it('rejeita senha menor que 8 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/me/password',
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { currentPassword: 'analystpass', newPassword: '1234' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/users', () => {
  it('admin lista todos', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
  })
  it('analista é bloqueado com 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { authorization: `Bearer ${analystToken}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({ error: 'admin_required' })
  })
  it('sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/users (admin cria)', () => {
  it('cria com senha padrão + must_change_password=true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'novo@ivy.com', nome: 'Novato', role: 'analista' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as Record<string, unknown>
    expect(body.must_change_password).toBe(true)
    expect(body.default_password).toBe(DEFAULT_PASSWORD)
    // novo user consegue logar com senha padrão
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'novo@ivy.com', password: DEFAULT_PASSWORD },
    })
    expect(login.statusCode).toBe(200)
    expect((login.json() as { user: { must_change_password: boolean } }).user.must_change_password).toBe(true)
  })
  it('409 em email duplicado', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'admin@ivy.com', nome: 'Duplicado' },
    })
    expect(r.statusCode).toBe(409)
  })
})

describe('PATCH /api/users/:id', () => {
  it('admin promove analista a admin', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${analystId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: 'admin' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ role: 'admin' })
  })
  it('admin desativa analista', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${analystId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { active: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ active: false })
    // analista inativo NÃO consegue logar
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analyst@ivy.com', password: 'analystpass' },
    })
    expect(login.statusCode).toBe(403)
    expect(login.json()).toMatchObject({ error: 'user_inactive' })
  })
  it('NÃO permite admin se rebaixar', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: 'analista' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'cannot_demote_self' })
  })
  it('NÃO permite admin se desativar', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { active: false },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'cannot_deactivate_self' })
  })
  it('NÃO permite remover último admin (rebaixar admin único)', async () => {
    // promove o analista pra admin
    await pool.query(`UPDATE users SET role='admin' WHERE id=$1`, [analystId])
    // depois rebaixa o admin original — analista virou admin único, devia ficar permitido
    const okPromote = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { active: false },
    })
    expect(okPromote.statusCode).toBe(400) // não pode desativar self
    // agora se for o analista admin desativando admin original
    const newAdminToken = signToken({ userId: analystId, email: 'analyst@ivy.com', role: 'admin' })
    const okDeact = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: { authorization: `Bearer ${newAdminToken}` },
      payload: { active: false },
    })
    expect(okDeact.statusCode).toBe(200) // pode, há outro admin (o analystId)
    // agora tentar desativar o último admin (analystId by analystId) → cannot_deactivate_self
    const last = await app.inject({
      method: 'PATCH',
      url: `/api/users/${analystId}`,
      headers: { authorization: `Bearer ${newAdminToken}` },
      payload: { active: false },
    })
    expect(last.statusCode).toBe(400)
  })
  it('analista é bloqueado em PATCH', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/users/${adminId}`,
      headers: { authorization: `Bearer ${analystToken}` },
      payload: { role: 'analista' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/users/:id/reset-password', () => {
  it('admin reseta senha de analista → marca must_change_password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/users/${analystId}/reset-password`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, default_password: DEFAULT_PASSWORD })

    // analista pode logar com senha padrão; flag indica troca obrigatória
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'analyst@ivy.com', password: DEFAULT_PASSWORD },
    })
    expect(login.statusCode).toBe(200)
    expect((login.json() as { user: { must_change_password: boolean } }).user.must_change_password).toBe(true)
  })
})
