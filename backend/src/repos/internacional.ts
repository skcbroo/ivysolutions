import { pool } from '../db.js'
import type { Sancao, EmpresaExterior, VinculoOffshore } from '../blocks/block4.js'

export async function insertSancoes(investigacaoId: number, sancoes: Sancao[]): Promise<void> {
  if (sancoes.length === 0) return
  const COLS = 9
  const values: unknown[] = []
  const ph: string[] = []
  sancoes.forEach((s, idx) => {
    const b = idx * COLS
    ph.push(`(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(',')})`)
    values.push(
      investigacaoId,
      s.entidade,
      s.score,
      s.match,
      s.paises,
      s.programas,
      s.listas,
      s.aliases,
      s.url,
    )
  })
  await pool.query(
    `INSERT INTO investigacao_sancoes
       (investigacao_id, entidade, score, match, paises, programas, listas, aliases, url)
     VALUES ${ph.join(',')}`,
    values,
  )
}

export async function insertEmpresasExterior(
  investigacaoId: number,
  empresas: EmpresaExterior[],
): Promise<void> {
  if (empresas.length === 0) return
  const COLS = 10
  const values: unknown[] = []
  const ph: string[] = []
  empresas.forEach((e, idx) => {
    const b = idx * COLS
    ph.push(`(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(',')})`)
    values.push(
      investigacaoId,
      e.officer,
      e.empresa,
      e.numero,
      e.jurisdicao,
      e.cargo,
      e.entrada,
      e.saida,
      e.url,
      e.score,
    )
  })
  await pool.query(
    `INSERT INTO investigacao_empresas_exterior
       (investigacao_id, officer, empresa, numero, jurisdicao, cargo, entrada, saida, url, score)
     VALUES ${ph.join(',')}`,
    values,
  )
}

export type SancaoRow = {
  entidade: string
  score: number | null
  match: boolean
  paises: string[]
  programas: string[]
  listas: string[]
  aliases: string[]
  url: string | null
}

export type EmpresaExteriorRow = {
  officer: string
  empresa: string
  numero: string | null
  jurisdicao: string
  cargo: string | null
  entrada: string | null
  saida: string | null
  url: string | null
  score: number | null
}

export async function listSancoes(investigacaoId: number): Promise<SancaoRow[]> {
  const { rows } = await pool.query(
    `SELECT entidade, score, match, paises, programas, listas, aliases, url
       FROM investigacao_sancoes
      WHERE investigacao_id = $1
      ORDER BY match DESC, score DESC NULLS LAST`,
    [investigacaoId],
  )
  return rows as SancaoRow[]
}

export async function listEmpresasExterior(investigacaoId: number): Promise<EmpresaExteriorRow[]> {
  const { rows } = await pool.query(
    `SELECT officer, empresa, numero, jurisdicao, cargo, entrada, saida, url, score
       FROM investigacao_empresas_exterior
      WHERE investigacao_id = $1
      ORDER BY entrada DESC NULLS LAST`,
    [investigacaoId],
  )
  return rows as EmpresaExteriorRow[]
}

export async function insertOffshore(
  investigacaoId: number,
  vinculos: VinculoOffshore[],
): Promise<void> {
  if (vinculos.length === 0) return
  const COLS = 7
  const values: unknown[] = []
  const ph: string[] = []
  vinculos.forEach((v, idx) => {
    const b = idx * COLS
    ph.push(`(${Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`).join(',')})`)
    values.push(investigacaoId, v.entidade, v.tipo, v.dataset, v.score, v.match, v.url)
  })
  await pool.query(
    `INSERT INTO investigacao_offshore
       (investigacao_id, entidade, tipo, dataset, score, match, url)
     VALUES ${ph.join(',')}`,
    values,
  )
}

export type OffshoreRow = {
  entidade: string
  tipo: string | null
  dataset: string
  score: number | null
  match: boolean
  url: string | null
}

export async function listOffshore(investigacaoId: number): Promise<OffshoreRow[]> {
  const { rows } = await pool.query(
    `SELECT entidade, tipo, dataset, score, match, url
       FROM investigacao_offshore
      WHERE investigacao_id = $1
      ORDER BY match DESC, score DESC NULLS LAST`,
    [investigacaoId],
  )
  return rows as OffshoreRow[]
}
