import { httpJson } from './http.js'
import { categoriaPt, statusPt, jurisdicaoPt, dataPt } from './icij-i18n.js'

/**
 * Cliente do ICIJ Offshore Leaks Database via Reconciliation API (JSON, pública,
 * sem chave). Cada dataset tem seu próprio endpoint — não há busca "em todos"
 * de uma vez, então o Block 4 itera os datasets.
 *
 * Doc: https://offshoreleaks.icij.org/docs/reconciliation
 *   POST /api/v1/reconcile/{dataset}  body: { query, limit, [type] }  → HTTP 201
 *   → { result: [{ id, name, score, match, types: [{id,name}] }] }
 * Sem `type`, busca todas as categorias (Officer/Entity/Intermediary/Address).
 */

const HOST = 'https://offshoreleaks.icij.org'
const BASE = `${HOST}/api/v1`

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
  /**
   * Restringe a um tipo (Officer | Entity | Intermediary | Address | Other).
   * Omitido (padrão) → busca em TODAS as categorias — o alvo pode constar como
   * Officer, mas também como Entity/Intermediary/Address.
   */
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
  // Sem `type` → a API busca em todas as categorias.
  const payload: Record<string, unknown> = { query: nome, limit: opts.limit ?? 10 }
  if (opts.type) payload.type = opts.type
  const body = JSON.stringify(payload)

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
  return `${HOST}/nodes/${id}`
}

/** Nó conectado ao alvo no grafo (entidade offshore, endereço, intermediário). */
export type IcijConnection = {
  id: string
  /** Entity | Address | Intermediary | Officer */
  categoria: string | null
  nome: string
  jurisdicao: string | null
  endereco: string | null
  status: string | null
  incorporacao: string | null
  url: string | null
}

type RawNode = {
  id?: number | string
  data?: {
    categories?: string[]
    category?: string
    properties?: Record<string, string | undefined>
  }
}

/**
 * Busca os nós CONECTADOS a um nó (1 nível do grafo): a partir de um Officer,
 * traz a(s) Entity, Address e Intermediary ligados. Endpoint público:
 * `GET /nodes/{id}.json` → array de nós conectados (HTTP 200).
 * Enriquecimento best-effort: falha aqui não invalida o vínculo encontrado.
 */
export async function getConnections(id: string): Promise<IcijConnection[]> {
  const { status, data } = await httpJson<RawNode[]>(`${HOST}/nodes/${id}.json`, {
    retries: 2,
    retryDelayMs: 1_500,
    timeoutMs: 20_000,
  })
  if (status < 200 || status >= 300 || !Array.isArray(data)) return []
  return data
    .map((n) => {
      const p = n.data?.properties ?? {}
      const cats = n.data?.categories ?? (n.data?.category ? [n.data.category] : [])
      const nid = n.id != null ? String(n.id) : ''
      return {
        id: nid,
        categoria: categoriaPt(cats[0] ?? null),
        nome: p.name ?? p.address ?? '',
        jurisdicao: jurisdicaoPt(p.jurisdiction_description ?? p.jurisdiction ?? null),
        endereco: p.address ?? null,
        status: statusPt(p.status ?? null),
        incorporacao: dataPt(p.incorporation_date ?? null),
        url: nid ? nodeUrl(nid) : null,
      }
    })
    .filter((c) => c.nome)
}
