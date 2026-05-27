import { pool } from '../db.js'
import type { EmpresaNormalizada } from '../blocks/block1.js'
import { toDate } from '../utils/format.js'

export async function bulkInsert(
  investigacaoId: number,
  empresas: EmpresaNormalizada[],
): Promise<void> {
  for (const e of empresas) {
    await pool.query(
      `INSERT INTO empresas (investigacao_id, cnpj14, nome, nome_fantasia, situacao,
        data_situacao, abertura, capital, cnae, natureza, porte, cargo,
        data_entrada, endereco, email, telefone, qsa, alertas, emails, telefones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb)`,
      [
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
      ],
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
