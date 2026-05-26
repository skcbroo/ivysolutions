import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { pool } from '../src/db.js'
import { deleteAllUsers, registerAndLogin, resetDomain } from './helpers.js'

// Evita disparar APIs externas reais durante E2E.
vi.mock('../src/worker.js', async () => {
  const actual = await vi.importActual<typeof import('../src/worker.js')>('../src/worker.js')
  return {
    ...actual,
    runWorker: vi.fn(async () => {
      // no-op: investigação fica em status='rodando' até alguém atualizar
    }),
  }
})

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

describe('Guarda JWT em /api/investigacoes', () => {
  it('GET sem token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/investigacoes' })
    expect(res.statusCode).toBe(401)
  })
  it('GET com token inválido → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/investigacoes',
      headers: { authorization: 'Bearer abc.def.ghi' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/investigacoes — criação', () => {
  it('rejeita CPF inválido', async () => {
    const { token } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'João Silva', cpf: '12345' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json() as { error: string; fields?: Record<string, string[]> }
    expect(body.error).toBe('invalid_input')
  })

  it('rejeita nome muito curto', async () => {
    const { token } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Jo', cpf: '06256739809' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('aceita CPF com máscara e normaliza', async () => {
    const { token } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'João da Silva', cpf: '062.567.398-09' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; status: string; cpf: string }
    expect(body.status).toBe('pendente')
    // CPF retornado é mascarado para o cliente
    expect(body.cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
  })

  it('grava created_by com o user do JWT', async () => {
    const { token, userId } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Tester Alvo', cpf: '11122233344' },
    })
    expect(res.statusCode).toBe(201)
    const id = (res.json() as { id: string }).id
    const { rows } = await pool.query(`SELECT created_by FROM investigacoes WHERE id=$1`, [id])
    expect(Number(rows[0].created_by)).toBe(userId)
  })
})

describe('GET /api/investigacoes/:id', () => {
  it('404 para id inexistente', async () => {
    const { token } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/investigacoes/9999',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('400 para id não numérico', async () => {
    const { token } = await registerAndLogin(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/investigacoes/abc',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })

  it('retorna investigação completa com listas vazias', async () => {
    const { token } = await registerAndLogin(app)
    const created = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Alvo Pleno', cpf: '11122233344' },
    })
    const id = (created.json() as { id: string }).id

    const res = await app.inject({
      method: 'GET',
      url: `/api/investigacoes/${id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body.empresas).toEqual([])
    expect(body.processos).toEqual([])
    expect(body.advogados).toEqual([])
    expect(body.cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)
  })
})

describe('GET /api/investigacoes/:id/status', () => {
  it('retorna apenas campos de status', async () => {
    const { token } = await registerAndLogin(app)
    const created = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Alvo Status', cpf: '11122233344' },
    })
    const id = (created.json() as { id: string }).id

    const res = await app.inject({
      method: 'GET',
      url: `/api/investigacoes/${id}/status`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(
      ['capital_total', 'erro_msg', 'pje_count', 'progresso', 'status'].sort(),
    )
  })
})

describe('Reap orphaned runs no boot', () => {
  it('marca investigações órfãs (status=rodando) como erro', async () => {
    const { reapOrphanedRuns } = await import('../src/worker.js')
    const { token } = await registerAndLogin(app)
    const created = await app.inject({
      method: 'POST',
      url: '/api/investigacoes',
      headers: { authorization: `Bearer ${token}` },
      payload: { nome: 'Alvo Reap', cpf: '11122233344' },
    })
    expect(created.statusCode).toBe(201)
    const id = (created.json() as { id: string }).id
    expect(id).toBeTruthy()

    // força orfã (status=rodando sem worker ativo)
    const upd = await pool.query(
      `UPDATE investigacoes SET status='rodando' WHERE id=$1 RETURNING id, status`,
      [id],
    )
    expect(upd.rows[0]?.status).toBe('rodando')

    await reapOrphanedRuns()

    const { rows } = await pool.query(
      `SELECT status, erro_msg FROM investigacoes WHERE id=$1`,
      [id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('erro')
    expect(rows[0].erro_msg).toMatch(/servidor reiniciado/i)
  })
})
