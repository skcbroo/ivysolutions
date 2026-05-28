import { httpJson } from './http.js'

/**
 * Cliente do ICIJ Offshore Leaks Database via Reconciliation API (JSON, pública,
 * sem chave). Cada dataset tem seu próprio endpoint — não há busca "em todos"
 * de uma vez, então o Block 4 itera os datasets.
 *
 * Doc: https://offshoreleaks.icij.org/docs/reconciliation
 *   POST /api/v1/reconcile/{dataset}  body: { query, type, limit }
 *   → { result: [{ id, name, score, match, type: [{id,name}] }] }
 */

const BASE = 'https://offshoreleaks.icij.org/api/v1'

/** Datasets do ICIJ. O slug é usado direto na URL do endpoint. */
export const ICIJ_DATASETS = [
  'panama-papers',
  'pandora-papers',
  'paradise-papers',
  'bahamas-leaks',
  'offshore-leaks',
] as const

export type IcijDataset = (typeof ICIJ_DATASETS)[number]

export type IcijResult = {
  id: string
  name: string
  score: number
  match: boolean
  /** Officer | Entity | Intermediary | Address | Other (nomes dos tipos). */
  types: string[]
  /** Dataset que respondeu (origem do vazamento). */
  dataset: IcijDataset
}

export class OffshoreLeaksError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

type TypeEntry = { id?: string; name?: string } | string
type ReconcileEntry = {
  id?: string
  name?: string
  score?: number
  match?: boolean
  // A API real devolve `types` (plural); aceitamos `type` como fallback.
  types?: TypeEntry[] | TypeEntry
  type?: TypeEntry[] | TypeEntry
}
type ReconcileResponse = { result?: ReconcileEntry[] }

function normalizeTypes(type: TypeEntry[] | TypeEntry | undefined): string[] {
  if (!type) return []
  const arr = Array.isArray(type) ? type : [type]
  return arr
    .map((t) => (typeof t === 'string' ? t : t?.name ?? t?.id ?? ''))
    .filter((s): s is string => !!s)
}

export type ReconcileOptions = {
  /** Tipo de entidade a buscar. `Officer` cobre pessoas físicas. */
  type?: string
  /** Nº máximo de candidatos por dataset. */
  limit?: number
}

/**
 * Reconcilia um nome em UM dataset do ICIJ. Lança OffshoreLeaksError em
 * resposta não-200 (a tolerância entre datasets fica a cargo do Block 4).
 */
export async function reconcile(
  nome: string,
  dataset: IcijDataset,
  opts: ReconcileOptions = {},
): Promise<IcijResult[]> {
  const url = `${BASE}/reconcile/${dataset}`
  const body = JSON.stringify({ query: nome, type: opts.type ?? 'Officer', limit: opts.limit ?? 5 })

  const { status, data, text } = await httpJson<ReconcileResponse>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    retries: 3,
    retryDelayMs: 2_000,
    timeoutMs: 30_000,
  })

  // A API responde 201 (Created) no sucesso — aceita qualquer 2xx.
  if (status < 200 || status >= 300 || !data) {
    throw new OffshoreLeaksError(status, data, text || `HTTP ${status}`)
  }

  return (data.result ?? [])
    .filter((r): r is ReconcileEntry & { id: string; name: string } => !!r.id && !!r.name)
    .map((r) => ({
      id: r.id,
      name: r.name,
      score: typeof r.score === 'number' ? r.score : 0,
      match: r.match ?? false,
      types: normalizeTypes(r.types ?? r.type),
      dataset,
    }))
}

/** URL pública do nó (página de detalhe humana). */
export function nodeUrl(id: string): string {
  return `https://offshoreleaks.icij.org/nodes/${id}`
}
