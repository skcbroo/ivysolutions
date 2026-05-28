import { pool } from '../db.js'
import { DEFAULT_OPCOES, type Opcoes } from '../opcoes.js'

export type InvestigacaoRow = {
  id: number
  created_at: Date
  updated_at: Date
  nome: string
  cpf: string
  status: string
  progresso: unknown
  capital_total: string | number | null
  pje_count: number | null
  erro_msg: string | null
  uuid_cnpja: string | null
  cpf_mascarado: string | null
  warnings: unknown
  opcoes: unknown
  falhas: unknown
  created_by: number | null
}

export type Falha = { bloco: string; msg: string }

export async function create(input: {
  nome: string
  cpf: string
  createdBy: number | null
  opcoes?: Opcoes
}): Promise<InvestigacaoRow> {
  const { rows } = await pool.query(
    `INSERT INTO investigacoes (nome, cpf, created_by, opcoes)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
    [input.nome, input.cpf, input.createdBy, JSON.stringify(input.opcoes ?? DEFAULT_OPCOES)],
  )
  return rows[0] as InvestigacaoRow
}

export async function findById(id: number): Promise<InvestigacaoRow | null> {
  const { rows } = await pool.query(`SELECT * FROM investigacoes WHERE id = $1`, [id])
  return (rows[0] ?? null) as InvestigacaoRow | null
}

export async function findRunInfo(
  id: number,
): Promise<{ id: number; nome: string; cpf: string; opcoes: unknown } | null> {
  const { rows } = await pool.query(
    `SELECT id, nome, cpf, opcoes FROM investigacoes WHERE id = $1`,
    [id],
  )
  return rows[0] ?? null
}

export type StatusRow = {
  status: string
  progresso: unknown
  capital_total: string | number | null
  pje_count: number | null
  erro_msg: string | null
  falhas: unknown
}

export async function findStatus(id: number): Promise<StatusRow | null> {
  const { rows } = await pool.query(
    `SELECT status, progresso, capital_total, pje_count, erro_msg, falhas
       FROM investigacoes WHERE id = $1`,
    [id],
  )
  return (rows[0] ?? null) as StatusRow | null
}

export async function listRecent(limit = 200, createdBy?: number) {
  if (createdBy !== undefined) {
    const { rows } = await pool.query(
      `SELECT id, created_at, updated_at, nome, cpf, status, progresso,
              capital_total, pje_count, erro_msg
         FROM investigacoes
        WHERE created_by = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [createdBy, limit],
    )
    return rows
  }
  const { rows } = await pool.query(
    `SELECT id, created_at, updated_at, nome, cpf, status, progresso,
            capital_total, pje_count, erro_msg
       FROM investigacoes
       ORDER BY created_at DESC
       LIMIT $1`,
    [limit],
  )
  return rows
}

export async function setStatus(id: number, status: string, erroMsg?: string): Promise<void> {
  if (erroMsg !== undefined) {
    await pool.query(
      `UPDATE investigacoes SET status = $1, erro_msg = $2, updated_at = now() WHERE id = $3`,
      [status, erroMsg, id],
    )
    return
  }
  await pool.query(
    `UPDATE investigacoes SET status = $1, updated_at = now() WHERE id = $2`,
    [status, id],
  )
}

/** Finaliza com status + falhas isoladas por bloco (concluido / concluido_parcial). */
export async function finalizeExecucao(
  id: number,
  status: string,
  falhas: Falha[],
): Promise<void> {
  const erroMsg = status === 'erro' && falhas.length > 0
    ? falhas.map((f) => `${f.bloco}: ${f.msg}`).join(' | ')
    : null
  await pool.query(
    `UPDATE investigacoes SET status = $1, falhas = $2::jsonb, erro_msg = $3, updated_at = now() WHERE id = $4`,
    [status, JSON.stringify(falhas), erroMsg, id],
  )
}

export async function setProgresso(id: number, progresso: object): Promise<void> {
  await pool.query(
    `UPDATE investigacoes SET progresso = $1::jsonb, updated_at = now() WHERE id = $2`,
    [JSON.stringify(progresso), id],
  )
}

export async function finalizeBlock1(
  id: number,
  data: { uuid: string | null; cpfMasked: string | null; capitalTotal: number; warnings: unknown[] },
): Promise<void> {
  await pool.query(
    `UPDATE investigacoes
        SET uuid_cnpja = $1, cpf_mascarado = $2, capital_total = $3, warnings = $4::jsonb
      WHERE id = $5`,
    [data.uuid, data.cpfMasked, data.capitalTotal, JSON.stringify(data.warnings ?? []), id],
  )
}

export async function finalizePjeCount(id: number, count: number): Promise<void> {
  await pool.query(`UPDATE investigacoes SET pje_count = $1 WHERE id = $2`, [count, id])
}

/** Limpa tudo (uso restrito a testes). */
export async function truncateAll(): Promise<void> {
  await pool.query(`TRUNCATE investigacoes RESTART IDENTITY CASCADE`)
}

/**
 * Marca como 'erro' investigações que ficaram em 'rodando' (servidor morreu
 * no meio). Idempotente, chamada no boot.
 */
export async function reapOrphaned(): Promise<void> {
  await pool.query(
    `UPDATE investigacoes
        SET status = 'erro',
            erro_msg = COALESCE(erro_msg, 'servidor reiniciado durante execução'),
            updated_at = now()
      WHERE status = 'rodando'`,
  )
}
