import { httpJson } from './http.js'
import { cnpjwsQueue } from './queue.js'

const BASE = 'https://publica.cnpj.ws/cnpj'

export type CnpjWsResponse = {
  cnpj_raiz?: string
  razao_social?: string
  capital_social?: string | number
  natureza_juridica?: { id?: string; descricao?: string }
  porte?: { id?: string; descricao?: string }
  estabelecimento?: {
    cnpj?: string
    nome_fantasia?: string | null
    tipo?: string
    situacao_cadastral?: string
    data_situacao_cadastral?: string
    data_inicio_atividade?: string
    atividade_principal?: { id?: string; descricao?: string }
    logradouro?: string | null
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cep?: string | null
    ddd1?: string | null
    telefone1?: string | null
    ddd2?: string | null
    telefone2?: string | null
    email?: string | null
    estado?: { sigla?: string; nome?: string }
    cidade?: { nome?: string }
  }
  socios?: Array<{
    nome?: string
    cpf_cnpj_socio?: string
    qualificacao_socio?: { descricao?: string }
    data_entrada?: string
    faixa_etaria?: string
  }>
}

/**
 * Free tier público (publica.cnpj.ws): ~3 req/min. Cliente fica atrás da
 * cnpjwsQueue; 429 sobe via httpJson com backoff.
 */
export async function fetchCnpjWs(cnpj14: string): Promise<CnpjWsResponse | null> {
  const c = cnpj14.replace(/\D/g, '')
  return cnpjwsQueue.add(async () => {
    const { status, data } = await httpJson<CnpjWsResponse>(`${BASE}/${c}`, {
      retries: 3,
      retryDelayMs: 2_500,
      timeoutMs: 20_000,
    })
    if (status !== 200 || !data) return null
    return data
  }) as Promise<CnpjWsResponse | null>
}

export function formatPhoneCnpjWs(ddd: string | null | undefined, num: string | null | undefined): string | null {
  const d = (ddd ?? '').replace(/\D/g, '')
  const n = (num ?? '').replace(/\D/g, '')
  if (!d || !n) return null
  if (n.length === 9) return `(${d}) ${n.slice(0, 5)}-${n.slice(5)}`
  if (n.length === 8) return `(${d}) ${n.slice(0, 4)}-${n.slice(4)}`
  return `(${d}) ${n}`
}
