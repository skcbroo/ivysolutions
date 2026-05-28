import { beforeEach, describe, expect, it } from 'vitest'
import { pool } from '../src/db.js'
import * as processosRepo from '../src/repos/processos.js'
import { resetDomain } from './helpers.js'

async function criarInvestigacao(): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO investigacoes (nome, cpf) VALUES ($1, $2) RETURNING id`,
    ['Repo Test', '11122233344'],
  )
  return Number(rows[0].id)
}

async function seedProcesso(investigacaoId: number, numero: string): Promise<void> {
  await pool.query(
    `INSERT INTO processos (investigacao_id, numero, tribunal, classe, criminal, comunicacoes)
     VALUES ($1, $2, 'TJSP', 'EXECUÇÃO', false, '[]'::jsonb)`,
    [investigacaoId, numero],
  )
}

beforeEach(async () => {
  await resetDomain()
})

describe('processosRepo.updateAnaliseLlm', () => {
  it('aplica análise em todos os processos do Map em uma chamada batched', async () => {
    const invId = await criarInvestigacao()
    await seedProcesso(invId, 'P-001')
    await seedProcesso(invId, 'P-002')
    await seedProcesso(invId, 'P-003')

    const analises = new Map<string, string>([
      ['P-001', 'penhora BACEN-JUD R$ 100k'],
      ['P-002', 'sentença trânsito em julgado'],
      ['P-003', 'Sem dados patrimoniais relevantes.'],
    ])
    await processosRepo.updateAnaliseLlm(invId, analises)

    const { rows } = await pool.query(
      `SELECT numero, analise_llm FROM processos WHERE investigacao_id=$1 ORDER BY numero`,
      [invId],
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ numero: 'P-001', analise_llm: 'penhora BACEN-JUD R$ 100k' })
    expect(rows[1]).toEqual({ numero: 'P-002', analise_llm: 'sentença trânsito em julgado' })
    expect(rows[2]).toEqual({ numero: 'P-003', analise_llm: 'Sem dados patrimoniais relevantes.' })
  })

  it('é no-op quando o Map está vazio', async () => {
    const invId = await criarInvestigacao()
    await seedProcesso(invId, 'P-001')
    await processosRepo.updateAnaliseLlm(invId, new Map())
    const { rows } = await pool.query(
      `SELECT analise_llm FROM processos WHERE investigacao_id=$1`,
      [invId],
    )
    expect(rows[0].analise_llm).toBeNull()
  })

  it('não toca em processos de outras investigações com o mesmo número', async () => {
    const invA = await criarInvestigacao()
    const invB = await criarInvestigacao()
    await seedProcesso(invA, 'X-99')
    await seedProcesso(invB, 'X-99')

    await processosRepo.updateAnaliseLlm(invA, new Map([['X-99', 'só na A']]))

    const { rows: a } = await pool.query(
      `SELECT analise_llm FROM processos WHERE investigacao_id=$1`,
      [invA],
    )
    const { rows: b } = await pool.query(
      `SELECT analise_llm FROM processos WHERE investigacao_id=$1`,
      [invB],
    )
    expect(a[0].analise_llm).toBe('só na A')
    expect(b[0].analise_llm).toBeNull()
  })

  it('aguenta batches grandes (>200 processos via múltiplas queries internas)', async () => {
    const invId = await criarInvestigacao()
    const numeros = Array.from({ length: 250 }, (_, i) => `P-${String(i).padStart(4, '0')}`)
    for (const n of numeros) await seedProcesso(invId, n)
    const analises = new Map(numeros.map((n) => [n, `análise ${n}`]))

    await processosRepo.updateAnaliseLlm(invId, analises)

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
         FROM processos
        WHERE investigacao_id=$1 AND analise_llm IS NOT NULL`,
      [invId],
    )
    expect(rows[0].n).toBe(250)
  })
})
