import { pool } from '../db.js'

export async function upsert(investigacaoId: number, conteudoMd: string): Promise<void> {
  await pool.query(
    `INSERT INTO relatorios (investigacao_id, conteudo_md) VALUES ($1, $2)
     ON CONFLICT (investigacao_id) DO UPDATE
       SET conteudo_md = EXCLUDED.conteudo_md, gerado_em = now()`,
    [investigacaoId, conteudoMd],
  )
}

export async function findByInvestigacao(
  investigacaoId: number,
): Promise<{ conteudo_md: string; gerado_em: Date } | null> {
  const { rows } = await pool.query(
    `SELECT conteudo_md, gerado_em FROM relatorios WHERE investigacao_id = $1`,
    [investigacaoId],
  )
  return rows[0] ?? null
}
