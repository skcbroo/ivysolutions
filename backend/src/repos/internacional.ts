import { pool } from '../db.js'
import type { Block4Hit } from '../blocks/block4.js'

export async function bulkInsert(investigacaoId: number, hits: Block4Hit[]): Promise<void> {
  if (hits.length === 0) return
  const COLS = 10
  const values: unknown[] = []
  const placeholders: string[] = []
  hits.forEach((h, idx) => {
    const base = idx * COLS
    const ph = (n: number) => `$${base + n}`
    placeholders.push(
      `(${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},${ph(7)},${ph(8)},${ph(9)},${ph(10)})`,
    )
    values.push(
      investigacaoId,
      h.fonte,
      h.entidade,
      h.score,
      h.match,
      h.paises,
      h.programas,
      h.aliases,
      h.datasets,
      h.url,
    )
  })
  await pool.query(
    `INSERT INTO investigacao_internacional
       (investigacao_id, fonte, entidade, score, match, paises, programas, aliases, datasets, url)
     VALUES ${placeholders.join(',')}`,
    values,
  )
}

export type InternacionalRow = {
  fonte: string
  entidade: string
  score: number | null
  match: boolean
  paises: string[]
  programas: string[]
  aliases: string[]
  datasets: string[]
  url: string | null
}

export async function listByInvestigacao(investigacaoId: number): Promise<InternacionalRow[]> {
  const { rows } = await pool.query(
    `SELECT fonte, entidade, score, match, paises, programas, aliases, datasets, url
       FROM investigacao_internacional
      WHERE investigacao_id = $1
      ORDER BY match DESC, score DESC NULLS LAST`,
    [investigacaoId],
  )
  return rows as InternacionalRow[]
}
