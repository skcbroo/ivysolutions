import { httpJson } from './http.js'
import { config } from '../config.js'

/**
 * Cliente da Matching API do OpenSanctions (query-by-example).
 * A própria OpenSanctions recomenda /match em vez de /search para
 * verificação de entidades — retorna candidatos já com score e flag `match`.
 *
 * Doc: https://www.opensanctions.org/docs/api/matching/
 */

const BASE = 'https://api.opensanctions.org'

export type OpenSanctionsResult = {
  id: string
  caption: string
  schema: string
  score: number
  match: boolean
  datasets: string[]
  properties: Record<string, string[]>
}

type MatchResponse = {
  responses?: Record<
    string,
    { status?: number; results?: OpenSanctionsResult[]; error?: string } | undefined
  >
  error?: string
}

export class OpenSanctionsError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

export type MatchPersonOptions = {
  /** Sobrescreve a chave do config (útil em testes). */
  apiKey?: string
  /** Nº máximo de candidatos por consulta. */
  limit?: number
  /** Coleção/escopo. `default` cobre sanções + PEPs + outras fontes. */
  dataset?: string
}

/**
 * Busca uma pessoa pelo nome na Matching API.
 * Retorna os candidatos com score (ordenados pela própria API).
 * Sem API key, tenta o tier público (sujeito a rate limit mais agressivo).
 */
export async function matchPerson(
  nome: string,
  opts: MatchPersonOptions = {},
): Promise<OpenSanctionsResult[]> {
  const dataset = opts.dataset ?? 'default'
  const apiKey = opts.apiKey ?? config.OPENSANCTIONS_API_KEY
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey) headers.authorization = `ApiKey ${apiKey}`

  const url = `${BASE}/match/${dataset}?limit=${opts.limit ?? 5}`
  const body = JSON.stringify({
    queries: {
      q1: { schema: 'Person', properties: { name: [nome] } },
    },
  })

  const { status, data, text } = await httpJson<MatchResponse>(url, {
    method: 'POST',
    headers,
    body,
    retries: 3,
    retryDelayMs: 2_000,
    timeoutMs: 30_000,
  })

  if (status !== 200 || !data || data.error) {
    const msg = data?.error ?? text ?? `HTTP ${status}`
    throw new OpenSanctionsError(status, data, msg)
  }

  const resp = data.responses?.q1
  if (resp?.error) throw new OpenSanctionsError(status, data, resp.error)
  return resp?.results ?? []
}
