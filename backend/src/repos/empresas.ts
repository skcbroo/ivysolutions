import { pool } from '../db.js'
import type { EmpresaNormalizada } from '../blocks/block1.js'
import { toDate } from '../utils/format.js'

const EMPRESA_COLS = 20
const EMPRESAS_BATCH = 200

export async function bulkInsert(
  investigacaoId: number,
  empresas: EmpresaNormalizada[],
): Promise<void> {
  if (empresas.length === 0) return
  for (let i = 0; i < empresas.length; i += EMPRESAS_BATCH) {
    const slice = empresas.slice(i, i + EMPRESAS_BATCH)
    const values: unknown[] = []
    const placeholders: string[] = []
    slice.forEach((e, idx) => {
      const base = idx * EMPRESA_COLS
      const p = (n: number) => `$${base + n}`
      placeholders.push(
        `(${p(1)},${p(2)},${p(3)},${p(4)},${p(5)},${p(6)},${p(7)},${p(8)},${p(9)},${p(10)},${p(11)},${p(12)},${p(13)},${p(14)},${p(15)},${p(16)},${p(17)}::jsonb,${p(18)}::jsonb,${p(19)}::jsonb,${p(20)}::jsonb)`,
      )
      values.push(
        investigacaoId,
        e.cnpj14,
        e.nome,
        e.nomeFantasia,
        e.situacao,
        toDate(e.dataSituacao),
        toDate(e.abertura),
        e.capital,
        e.cnae,
        e.natureza,
        e.porte,
        e.cargo,
        toDate(e.dataEntrada),
        e.endereco,
        e.email,
        e.telefone,
        JSON.stringify(e.qsa ?? []),
        JSON.stringify(e.alertas ?? []),
        JSON.stringify(e.emails ?? []),
        JSON.stringify(e.telefones ?? []),
      )
    })
    await pool.query(
      `INSERT INTO empresas (investigacao_id, cnpj14, nome, nome_fantasia, situacao,
        data_situacao, abertura, capital, cnae, natureza, porte, cargo,
        data_entrada, endereco, email, telefone, qsa, alertas, emails, telefones)
       VALUES ${placeholders.join(',')}`,
      values,
    )
  }
}

export async function findByInvestigacao(investigacaoId: number) {
  const { rows } = await pool.query(
    `SELECT * FROM empresas WHERE investigacao_id = $1 ORDER BY id`,
    [investigacaoId],
  )
  return rows
}
