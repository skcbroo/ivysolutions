import { httpJson } from './http.js'

const BFF = 'https://bff.cnpja.com'

type SearchRecord =
  | {
      score: number
      index: 'person'
      person: { id: string; type?: string; name?: string; taxId?: string }
    }
  | {
      score: number
      index: 'office'
      office: { head?: boolean; taxId?: string; company?: { name?: string } }
    }

type SearchResponse = { records?: SearchRecord[] }

export type PersonMembership = {
  since?: string
  role?: { id?: number; text?: string }
  company?: {
    id?: string // CNPJ raiz (8 dígitos, sem zero à esquerda às vezes)
    name?: string
    equity?: number | string
    nature?: { id?: number; text?: string }
    size?: { id?: number; acronym?: string; text?: string }
  }
}

export type PersonProfile = {
  id: string
  name?: string
  type?: string
  taxId?: string // mascarado "***XXXXXX**"
  age?: string
  membership?: PersonMembership[]
}

export type PersonSearchResult =
  | { kind: 'matched'; personId: string; taxIdMasked: string | null }
  | { kind: 'unmatched_strict'; reason: string; candidatos: number }
  | { kind: 'no_results' }
  | { kind: 'unconfirmed_single'; personId: string; taxIdMasked: string | null }

/**
 * Etapa 1: busca pessoa por nome no BFF público da CNPJa.
 *
 * Regra de match (anti-homônimo):
 *  - Se ALGUM candidato tem CPF parcial igual ao do input → matched (alta confiança)
 *  - Se há MÚLTIPLOS candidatos e NENHUM bate → rejeita ('unmatched_strict')
 *  - Se há APENAS 1 candidato e ele tem CPF parcial (que não bate) → rejeita também
 *  - Se há 1 candidato com `taxId=null` (raro, BFF sem CPF) → aceita com baixa confiança
 *    ('unconfirmed_single') porque é o único caminho possível e o user assume o risco
 */
export async function searchPersonByName(
  nome: string,
  cpfCompleto: string,
): Promise<PersonSearchResult> {
  const url = `${BFF}/search?query=${encodeURIComponent(nome)}`
  const { status, data } = await httpJson<SearchResponse>(url, { retries: 2 })
  if (status !== 200 || !data?.records) return { kind: 'no_results' }

  const persons = data.records.filter(
    (r): r is Extract<SearchRecord, { index: 'person' }> => r.index === 'person',
  )
  if (persons.length === 0) return { kind: 'no_results' }

  const central = cpfCompleto.replace(/\D/g, '').padStart(11, '0').slice(3, 9)

  const matched = persons.find((p) => extractCentral(p.person.taxId) === central)
  if (matched) {
    return { kind: 'matched', personId: matched.person.id, taxIdMasked: matched.person.taxId ?? null }
  }

  // Caso raro: candidato único com taxId null (BFF sem CPF para conferir).
  // Só aceita match "fraco" se há exatamente 1 candidato sem taxId conhecido.
  if (persons.length === 1 && persons[0].person.taxId == null) {
    return {
      kind: 'unconfirmed_single',
      personId: persons[0].person.id,
      taxIdMasked: null,
    }
  }

  // Nenhum CPF parcial bate. Pode ser:
  //  - alvo não cadastrado na base CNPJa, OU
  //  - alvo cadastrado mas os top-20 do search são todos homônimos
  // Em ambos os casos, NÃO chutar um homônimo com score alto.
  return {
    kind: 'unmatched_strict',
    reason: `nenhum dos ${persons.length} candidatos com nome similar tem CPF parcial compatível`,
    candidatos: persons.length,
  }
}

export function extractCentral(taxIdMasked: string | undefined): string | null {
  if (!taxIdMasked) return null
  const m = /\*{3}(\d{6})\*{2}/.exec(taxIdMasked)
  return m ? m[1] : null
}

/**
 * Etapa 2: perfil completo da pessoa, incluindo membership.
 */
export async function getPersonProfile(personId: string): Promise<PersonProfile | null> {
  const { status, data } = await httpJson<PersonProfile>(`${BFF}/person/${personId}`, {
    retries: 2,
    retryDelayMs: 2_000,
  })
  if (status !== 200 || !data) return null
  return data
}

/**
 * Etapa 3: resolve CNPJ-raiz (8 dígitos) → CNPJ completo (14 dígitos) da matriz.
 * Usa o mesmo endpoint /search com o root como query — retorna o `office` com head=true.
 */
export async function resolveFullCnpjFromRoot(root: string): Promise<string | null> {
  const q = root.replace(/\D/g, '')
  const { status, data } = await httpJson<SearchResponse>(`${BFF}/search?query=${q}`, {
    retries: 2,
  })
  if (status !== 200 || !data?.records) return null

  const offices = data.records.filter(
    (r): r is Extract<SearchRecord, { index: 'office' }> => r.index === 'office',
  )
  const head = offices.find((o) => o.office.head) ?? offices[0]
  const taxId = head?.office.taxId?.replace(/\D/g, '')
  return taxId && taxId.length === 14 ? taxId : null
}
