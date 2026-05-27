import { pool } from '../db.js'
import type { Block2Processo, Block2Result } from '../blocks/block2.js'

const PROCESSOS_BATCH = 200

export async function bulkInsert(
  investigacaoId: number,
  processos: Block2Processo[],
): Promise<void> {
  if (processos.length === 0) return
  const COLS = 12
  for (let i = 0; i < processos.length; i += PROCESSOS_BATCH) {
    const slice = processos.slice(i, i + PROCESSOS_BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((p, idx) => {
      const base = idx * COLS
      const ph = (n: number) => `$${base + n}`
      placeholders.push(
        `(${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},${ph(7)},${ph(8)},${ph(9)},${ph(10)},${ph(11)},${ph(12)}::jsonb)`,
      )
      values.push(
        investigacaoId,
        p.numero,
        p.tribunal,
        p.orgao,
        p.classe,
        p.tipo,
        p.polo,
        p.link,
        p.criminal,
        p.vinculo,
        p.empresaVinculada,
        JSON.stringify(p.comunicacoes ?? []),
      )
    })
    await pool.query(
      `INSERT INTO processos (investigacao_id, numero, tribunal, orgao, classe, tipo, polo, link, criminal, vinculo, empresa_vinculada, comunicacoes)
       VALUES ${placeholders.join(',')}`,
      values,
    )
  }
}

export async function bulkInsertAdvogados(
  investigacaoId: number,
  advogados: Block2Result['advogados'],
): Promise<void> {
  if (advogados.length === 0) return
  const COLS = 3
  for (let i = 0; i < advogados.length; i += PROCESSOS_BATCH) {
    const slice = advogados.slice(i, i + PROCESSOS_BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((a, idx) => {
      const base = idx * COLS
      placeholders.push(`($${base + 1},$${base + 2},$${base + 3})`)
      values.push(investigacaoId, a.nome, a.oab)
    })
    await pool.query(
      `INSERT INTO processos_advogados (investigacao_id, nome, oab) VALUES ${placeholders.join(',')}`,
      values,
    )
  }
}

export async function bulkInsertEmpresasVinculadas(
  investigacaoId: number,
  empresas: Block2Result['empresasVinculadas'],
): Promise<void> {
  if (empresas.length === 0) return
  const COLS = 3
  for (let i = 0; i < empresas.length; i += PROCESSOS_BATCH) {
    const slice = empresas.slice(i, i + PROCESSOS_BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((e, idx) => {
      const base = idx * COLS
      placeholders.push(`($${base + 1},$${base + 2},$${base + 3})`)
      values.push(investigacaoId, e.nome, e.polo)
    })
    await pool.query(
      `INSERT INTO processos_empresas_vinculadas (investigacao_id, nome, polo) VALUES ${placeholders.join(',')}`,
      values,
    )
  }
}

export async function findByInvestigacao(investigacaoId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM processos WHERE investigacao_id = $1 ORDER BY id`,
    [investigacaoId],
  )
  return rows
}

export async function findAdvogados(investigacaoId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM processos_advogados WHERE investigacao_id = $1 ORDER BY id`,
    [investigacaoId],
  )
  return rows
}

export async function findEmpresasVinculadas(investigacaoId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM processos_empresas_vinculadas WHERE investigacao_id = $1 ORDER BY id`,
    [investigacaoId],
  )
  return rows
}
