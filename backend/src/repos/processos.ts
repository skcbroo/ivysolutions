import { pool } from '../db.js'
import type { Block2Processo, Block2Result } from '../blocks/block2.js'

export async function bulkInsert(
  investigacaoId: number,
  processos: Block2Processo[],
): Promise<void> {
  for (const p of processos) {
    await pool.query(
      `INSERT INTO processos (investigacao_id, numero, tribunal, orgao, classe, tipo, polo, link, criminal, vinculo, empresa_vinculada, comunicacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [
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
      ],
    )
  }
}

export async function bulkInsertAdvogados(
  investigacaoId: number,
  advogados: Block2Result['advogados'],
): Promise<void> {
  for (const a of advogados) {
    await pool.query(
      `INSERT INTO processos_advogados (investigacao_id, nome, oab) VALUES ($1,$2,$3)`,
      [investigacaoId, a.nome, a.oab],
    )
  }
}

export async function bulkInsertEmpresasVinculadas(
  investigacaoId: number,
  empresas: Block2Result['empresasVinculadas'],
): Promise<void> {
  for (const e of empresas) {
    await pool.query(
      `INSERT INTO processos_empresas_vinculadas (investigacao_id, nome, polo) VALUES ($1,$2,$3)`,
      [investigacaoId, e.nome, e.polo],
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
