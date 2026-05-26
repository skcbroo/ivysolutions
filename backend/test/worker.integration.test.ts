import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher, type Dispatcher } from 'undici'
import { pool } from '../src/db.js'
import { runWorker } from '../src/worker.js'
import { resetDomain } from './helpers.js'

const BFF = 'https://bff.cnpja.com'
const BRASIL = 'https://brasilapi.com.br'
const OPEN = 'https://open.cnpja.com'
const COM = 'https://comunicaapi.pje.jus.br'

let agent: MockAgent
let prev: Dispatcher

beforeAll(() => {
  prev = getGlobalDispatcher()
})
afterAll(() => setGlobalDispatcher(prev))

beforeEach(async () => {
  await resetDomain()
  // garante que existe pelo menos 1 user pra FK created_by (não obrigatório, mas realista)
  await pool.query(
    `INSERT INTO users (email, password_hash, nome) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO NOTHING`,
    ['worker-test@ivy.com', '$2a$10$abcdef', 'Worker Test'],
  )
  agent = new MockAgent()
  agent.disableNetConnect()
  setGlobalDispatcher(agent)
})

afterEach(async () => {
  await agent.close()
})

describe('runWorker — orquestração end-to-end com DB real', () => {
  it('persiste empresas + processos + relatório, finaliza status=concluido', async () => {
    // ── Cria investigação ──
    const { rows } = await pool.query(
      `INSERT INTO investigacoes (nome, cpf) VALUES ($1, $2) RETURNING id`,
      ['Worker E2E', '06256739809'],
    )
    const invId = Number(rows[0].id)

    // ── Mock Block1 ──
    const personId = 'wkr-uuid'
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Worker E2E' } }).reply(200, {
      records: [{ score: 9, index: 'person', person: { id: personId, name: 'Worker E2E', taxId: '***567398**' } }],
    })
    agent.get(BFF).intercept({ path: `/person/${personId}`, method: 'GET' }).reply(200, {
      id: personId,
      membership: [
        { role: { text: 'Administrador' }, since: '2020-01-01', company: { id: '12345678', name: 'EMPRESA TESTE LTDA', equity: 500_000 } },
      ],
    })
    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: '12345678' } }).reply(200, {
      records: [{ score: 1, index: 'office', office: { head: true, taxId: '12345678000190', company: { name: 'EMPRESA TESTE LTDA' } } }],
    })
    agent.get(BRASIL).intercept({ path: '/api/cnpj/v1/12345678000190' }).reply(200, {
      cnpj: '12345678000190',
      razao_social: 'EMPRESA TESTE LTDA',
      descricao_situacao_cadastral: 'ATIVA',
      capital_social: 500_000,
      ddd_telefone_1: '1133334444',
      qsa: [{ nome_socio: 'WORKER E2E', qualificacao_socio: 'Administrador' }],
    })
    agent.get(OPEN).intercept({ path: '/office/12345678000190' }).reply(200, {
      emails: [{ address: 'contato@teste.com.br' }],
      phones: [{ area: '11', number: '33334444' }],
    })

    // ── Mock Block2 (Comunica) ──
    // nomeParte=Worker E2E + texto=CPF formatado + texto=CPF puro + nomeParte=empresa
    agent
      .get(COM)
      .intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { nomeParte: 'Worker E2E', itensPorPagina: '100', pagina: '1' } })
      .reply(200, {
        items: [
          {
            id: 1,
            siglaTribunal: 'TJSP',
            nomeOrgao: '1ª Vara',
            numeroprocessocommascara: '1000000-01.2024.8.26.0001',
            nomeClasse: 'AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO',
            tipoComunicacao: 'Sentença',
            data_disponibilizacao: '2024-12-01',
            texto: 'Sentença <b>condenando</b> o réu.',
            link: 'https://pje.tjsp/x',
            destinatarios: [{ nome: 'WORKER E2E', polo: 'P' }],
            destinatarioadvogados: [
              { advogado: { nome: 'DR. FULANO', numero_oab: '12345', uf_oab: 'SP' } },
            ],
          },
        ],
      })
    agent.get(COM).intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { texto: '062.567.398-09', itensPorPagina: '100', pagina: '1' } }).reply(200, { items: [] })
    agent.get(COM).intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { texto: '06256739809', itensPorPagina: '100', pagina: '1' } }).reply(200, { items: [] })
    agent.get(COM).intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { nomeParte: 'EMPRESA TESTE LTDA', itensPorPagina: '100', pagina: '1' } }).reply(200, { items: [] })

    // ── Executa worker ──
    await runWorker(invId, { info: () => {}, warn: () => {}, error: () => {} })

    // ── Verifica estado final no DB ──
    const inv = (await pool.query(`SELECT * FROM investigacoes WHERE id=$1`, [invId])).rows[0]
    expect(inv.status).toBe('concluido')
    expect(inv.uuid_cnpja).toBe(personId)
    expect(inv.cpf_mascarado).toBe('062.567.398-09')
    expect(Number(inv.capital_total)).toBe(500_000)
    expect(inv.pje_count).toBe(1)
    expect(inv.erro_msg).toBeNull()

    const emp = (await pool.query(`SELECT * FROM empresas WHERE investigacao_id=$1`, [invId])).rows
    expect(emp).toHaveLength(1)
    expect(emp[0].nome).toBe('EMPRESA TESTE LTDA')
    expect(emp[0].situacao).toBe('ATIVA')
    expect(Number(emp[0].capital)).toBe(500_000)
    // emails JSONB vem da CNPJa Open
    expect(emp[0].emails).toEqual(['contato@teste.com.br'])
    expect(emp[0].telefones).toEqual(['(11) 3333-4444'])

    const proc = (await pool.query(`SELECT * FROM processos WHERE investigacao_id=$1`, [invId])).rows
    expect(proc).toHaveLength(1)
    expect(proc[0].criminal).toBe(true)
    expect(proc[0].vinculo).toBe('pessoal')
    expect(proc[0].polo).toBe('P')
    expect(proc[0].comunicacoes).toHaveLength(1)
    expect(proc[0].comunicacoes[0].tipo).toBe('Sentença')
    expect(proc[0].comunicacoes[0].texto).toContain('condenando')

    const adv = (await pool.query(`SELECT * FROM processos_advogados WHERE investigacao_id=$1`, [invId])).rows
    expect(adv).toHaveLength(1)
    expect(adv[0]).toMatchObject({ nome: 'DR. FULANO', oab: 'SP 12345' })

    const rel = (await pool.query(`SELECT * FROM relatorios WHERE investigacao_id=$1`, [invId])).rows[0]
    expect(rel).toBeDefined()
    expect(rel.conteudo_md).toMatch(/RELATÓRIO INVESTIGATIVO/i)
    expect(rel.conteudo_md).toContain('EMPRESA TESTE LTDA')
  })

  it('quando BFF não acha pessoa, completa com empresas vazias e processos via fonte', async () => {
    const { rows } = await pool.query(
      `INSERT INTO investigacoes (nome, cpf) VALUES ($1, $2) RETURNING id`,
      ['Sem Empresas', '11122233344'],
    )
    const invId = Number(rows[0].id)

    agent.get(BFF).intercept({ path: '/search', method: 'GET', query: { query: 'Sem Empresas' } }).reply(200, { records: [] })

    // Block2 — só responde queries que de fato são feitas (sem empresas, sem busca por razão)
    agent
      .get(COM)
      .intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { nomeParte: 'Sem Empresas', itensPorPagina: '100', pagina: '1' } })
      .reply(200, { items: [] })
    agent.get(COM).intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { texto: '111.222.333-44', itensPorPagina: '100', pagina: '1' } }).reply(200, { items: [] })
    agent.get(COM).intercept({ path: '/api/v1/comunicacao', method: 'GET', query: { texto: '11122233344', itensPorPagina: '100', pagina: '1' } }).reply(200, { items: [] })

    await runWorker(invId, { info: () => {}, warn: () => {}, error: () => {} })

    const inv = (await pool.query(`SELECT status, pje_count FROM investigacoes WHERE id=$1`, [invId])).rows[0]
    expect(inv.status).toBe('concluido')
    expect(inv.pje_count).toBe(0)
    const emp = (await pool.query(`SELECT count(*) FROM empresas WHERE investigacao_id=$1`, [invId])).rows[0].count
    expect(Number(emp)).toBe(0)
  })
})
