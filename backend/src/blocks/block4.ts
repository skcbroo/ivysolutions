import { matchPerson, OpenSanctionsError, type OpenSanctionsResult } from '../apis/opensanctions.js'

/**
 * Block 4: buscas internacionais. Primeira fonte é o OpenSanctions
 * (sanções, PEPs, pessoas de interesse). O formato de `Block4Hit` é
 * genérico para que as próximas fontes (Companies House, Offshore Leaks,
 * Sunbiz, Miami-Dade) apenas acrescentem hits à mesma lista.
 */

export const MATCH_SCORE_THRESHOLD = 0.7

export type Block4Logger = { info: (m: string) => void; warn: (m: string) => void }

export type Block4Hit = {
  fonte: string
  entidade: string
  score: number
  match: boolean
  paises: string[]
  programas: string[]
  aliases: string[]
  datasets: string[]
  url: string | null
}

export type Block4Result = {
  hits: Block4Hit[]
  erros: number
}

const uniq = (arr: string[]) => [...new Set(arr.filter((s) => s && s.length > 0))]

function toHit(r: OpenSanctionsResult): Block4Hit {
  const p = r.properties ?? {}
  return {
    fonte: 'opensanctions',
    entidade: r.caption,
    score: r.score,
    match: r.match,
    paises: uniq([...(p.country ?? []), ...(p.nationality ?? [])]),
    programas: uniq([...(p.program ?? []), ...(p.topics ?? [])]),
    aliases: uniq(p.alias ?? []),
    datasets: r.datasets ?? [],
    url: r.id ? `https://www.opensanctions.org/entities/${r.id}/` : null,
  }
}

export async function runBlock4(
  nome: string,
  logger?: Block4Logger,
  onProgress?: (atual: number, total: number) => Promise<void>,
): Promise<Block4Result> {
  const result: Block4Result = { hits: [], erros: 0 }

  logger?.info(`[block4] iniciando — OpenSanctions para "${nome}"`)
  await onProgress?.(0, 1)

  try {
    const candidatos = await matchPerson(nome)
    const relevantes = candidatos.filter(
      (c) => c.match || c.score >= MATCH_SCORE_THRESHOLD,
    )
    result.hits.push(...relevantes.map(toHit))
    logger?.info(
      `[block4] OpenSanctions — ${candidatos.length} candidato(s), ${relevantes.length} acima do corte`,
    )
  } catch (err) {
    result.erros++
    const msg =
      err instanceof OpenSanctionsError ? `${err.status} ${err.message}` : (err as Error).message
    logger?.warn(`[block4] OpenSanctions falhou — ${msg}`)
  }

  await onProgress?.(1, 1)
  logger?.info(`[block4] concluído — ${result.hits.length} hit(s) · erros=${result.erros}`)
  return result
}
