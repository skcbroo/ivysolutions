import {
  searchPersonByName,
  getPersonProfile,
  resolveFullCnpjFromRoot,
  type PersonMembership,
} from '../apis/cnpja-bff.js'
import { fetchCnpjFallback } from '../apis/cnpjbiz.js'
import { fetchCnpjWs, formatPhoneCnpjWs, type CnpjWsResponse } from '../apis/cnpjws.js'
import { formatCpf } from '../utils/format.js'

export type EmpresaNormalizada = {
  cnpj14: string
  nome?: string | null
  nomeFantasia?: string | null
  situacao?: string | null
  dataSituacao?: string | null
  abertura?: string | null
  capital?: number | null
  cnae?: string | null
  natureza?: string | null
  porte?: string | null
  cargo?: string | null
  dataEntrada?: string | null
  endereco?: string | null
  email?: string | null
  telefone?: string | null
  qsa: Array<{
    nome_socio?: string
    qualificacao_socio?: string
    data_entrada_sociedade?: string
    faixa_etaria?: string
  }>
  emails: string[]
  telefones: string[]
  alertas: string[]
}

export type Block1Result = {
  uuid: string | null
  cpfMasked: string | null
  totalCapital: number
  empresas: EmpresaNormalizada[]
  warnings: string[]
}

const PESSOAL_DOMAIN_RX = /@(gmail|hotmail|yahoo|outlook|live|icloud|uol|bol|terra|ig)\./i
const CAPITAL_ALTO = 1_000_000

export async function runBlock1(
  nome: string,
  cpf: string,
  onProgress: (atual: number, total: number) => Promise<void>,
  logger?: { info?: (m: string) => void; warn: (m: string) => void },
): Promise<Block1Result> {
  const warnings: string[] = []

  // Etapa 1: nome → person.id (com validação anti-homônimo por CPF parcial)
  const person = await searchPersonByName(nome, cpf)
  logger?.info?.(`[block1] searchPerson kind=${person.kind}`)

  if (person.kind === 'no_results') {
    warnings.push('Nenhuma pessoa com esse nome encontrada na base CNPJa.')
    return { uuid: null, cpfMasked: maskCpf(cpf), totalCapital: 0, empresas: [], warnings }
  }
  if (person.kind === 'unmatched_strict') {
    warnings.push(
      `Encontradas ${person.candidatos} pessoas com nome "${nome}", mas nenhuma tem CPF compatível com o informado. ` +
        `Verifique se o CPF está correto ou se o alvo é cadastrado na base de sócios da Receita Federal.`,
    )
    return { uuid: null, cpfMasked: maskCpf(cpf), totalCapital: 0, empresas: [], warnings }
  }
  if (person.kind === 'unconfirmed_single') {
    warnings.push(
      `Match por nome único (sem CPF na base CNPJa para conferir). Resultados podem ser de homônimo.`,
    )
  }
  logger?.info?.(`[block1] person.id=${person.personId}`)

  // Etapa 2: person.id → membership[]
  const profile = await getPersonProfile(person.personId)
  logger?.info?.(`[block1] profile membership=${profile?.membership?.length ?? 0}`)
  if (!profile?.membership || profile.membership.length === 0) {
    warnings.push('Pessoa identificada mas sem empresas vinculadas (membership vazio).')
    return { uuid: person.personId, cpfMasked: maskCpf(cpf), totalCapital: 0, empresas: [], warnings }
  }

  // Etapa 3: para cada empresa, resolve raiz → CNPJ14
  const total = profile.membership.length
  const empresas: EmpresaNormalizada[] = []
  const addressKeyByCnpj = new Map<string, string>()
  let totalCapital = 0

  for (let i = 0; i < total; i++) {
    const m = profile.membership[i]
    await onProgress(i + 1, total)
    const root = (m.company?.id ?? '').replace(/\D/g, '')
    if (!root) {
      empresas.push(blankEmpresa('00000000000000', m, ['root ausente']))
      continue
    }
    const cnpj14 = await resolveFullCnpjFromRoot(root.padStart(8, '0'))
    if (!cnpj14) {
      empresas.push(blankEmpresa(root.padStart(14, '0'), m, ['CNPJ completo não resolvido']))
      continue
    }

    // Fonte primária: publica.cnpj.ws. Fallback: scrape (cnpjbiz / publica.cnpj.ws via parser).
    const detail = await fetchCnpjWs(cnpj14)
    let scrape: Awaited<ReturnType<typeof fetchCnpjFallback>> | null = null
    if (!detail) scrape = await fetchCnpjFallback(cnpj14)

    let normalized: EmpresaNormalizada
    let addrParts: AddressParts | null = null
    if (detail) {
      normalized = normalizeCnpjWs(cnpj14, detail, nome, m)
      const est = detail.estabelecimento
      addrParts = {
        logradouro: est?.logradouro,
        numero: est?.numero,
        bairro: est?.bairro,
        cep: est?.cep,
      }
    } else if (scrape) {
      normalized = normalizeFallback(cnpj14, scrape, m)
    } else {
      normalized = blankEmpresa(cnpj14, m, ['dados não localizados'])
    }
    const k = addrParts ? makeAddressKey(addrParts) : null
    if (k) addressKeyByCnpj.set(cnpj14, k)

    if (normalized.capital) totalCapital += Number(normalized.capital)
    empresas.push(normalized)
  }
  logger?.info?.(`[block1] resumo: ${empresas.length}/${total} empresas processadas, capital=${totalCapital}`)

  // Alertas de cruzamento
  const emailCount = new Map<string, number>()
  for (const e of empresas) if (e.email) emailCount.set(e.email.toLowerCase(), (emailCount.get(e.email.toLowerCase()) ?? 0) + 1)
  const addrCount = new Map<string, number>()
  for (const e of empresas) {
    const k = addressKeyByCnpj.get(e.cnpj14)
    if (k) addrCount.set(k, (addrCount.get(k) ?? 0) + 1)
  }
  for (const e of empresas) {
    if (e.email && (emailCount.get(e.email.toLowerCase()) ?? 0) > 1) {
      e.alertas.push(`email compartilhado em ${emailCount.get(e.email.toLowerCase())} empresas`)
    }
    if (e.email && PESSOAL_DOMAIN_RX.test(e.email) && (e.capital ?? 0) >= CAPITAL_ALTO) {
      e.alertas.push('email pessoal em empresa de alto capital')
    }
    const k = addressKeyByCnpj.get(e.cnpj14)
    const n = k ? addrCount.get(k) ?? 0 : 0
    if (n > 1) e.alertas.push(`endereço compartilhado em ${n} empresas`)
  }

  return { uuid: person.personId, cpfMasked: maskCpf(cpf), totalCapital, empresas, warnings }
}

function blankEmpresa(cnpj14: string, m: PersonMembership, alertas: string[]): EmpresaNormalizada {
  return {
    cnpj14,
    nome: m.company?.name ?? null,
    nomeFantasia: null,
    situacao: 'desconhecida',
    dataSituacao: null,
    abertura: null,
    capital: typeof m.company?.equity === 'number' ? m.company.equity : null,
    cnae: null,
    natureza: m.company?.nature?.text ?? null,
    porte: m.company?.size?.text ?? null,
    cargo: m.role?.text ?? null,
    dataEntrada: m.since ?? null,
    endereco: null,
    email: null,
    telefone: null,
    qsa: [],
    emails: [],
    telefones: [],
    alertas,
  }
}

function normalizeCnpjWs(
  cnpj14: string,
  d: CnpjWsResponse,
  nomeAlvo: string,
  m: PersonMembership,
): EmpresaNormalizada {
  const est = d.estabelecimento
  const enderecoParts = [
    est?.logradouro,
    est?.numero,
    est?.bairro,
    est?.cidade?.nome,
    est?.estado?.sigla,
    est?.cep,
  ].filter(Boolean)
  const capitalRaw = typeof d.capital_social === 'string' ? Number(d.capital_social) : (d.capital_social ?? null)
  const capital = Number.isFinite(capitalRaw as number) ? (capitalRaw as number) : null
  const qsa = (d.socios ?? []).map((s) => ({
    nome_socio: s.nome,
    qualificacao_socio: s.qualificacao_socio?.descricao,
    data_entrada_sociedade: s.data_entrada,
    faixa_etaria: s.faixa_etaria,
  }))
  const socioAlvo = qsa.find((q) => q.nome_socio?.toUpperCase() === nomeAlvo.toUpperCase())
  const telefones = [
    formatPhoneCnpjWs(est?.ddd1, est?.telefone1),
    formatPhoneCnpjWs(est?.ddd2, est?.telefone2),
  ].filter((s): s is string => !!s)
  const emails = est?.email ? [est.email] : []
  return {
    cnpj14,
    nome: d.razao_social ?? null,
    nomeFantasia: est?.nome_fantasia ?? null,
    situacao: est?.situacao_cadastral ?? null,
    dataSituacao: est?.data_situacao_cadastral ?? null,
    abertura: est?.data_inicio_atividade ?? null,
    capital,
    cnae: est?.atividade_principal?.id
      ? `${est.atividade_principal.id} ${est.atividade_principal.descricao ?? ''}`.trim()
      : null,
    natureza: d.natureza_juridica?.descricao ?? m.company?.nature?.text ?? null,
    porte: d.porte?.descricao ?? m.company?.size?.text ?? null,
    cargo: socioAlvo?.qualificacao_socio ?? m.role?.text ?? null,
    dataEntrada: socioAlvo?.data_entrada_sociedade ?? m.since ?? null,
    endereco: enderecoParts.join(', ') || null,
    email: emails[0] ?? null,
    telefone: telefones[0] ?? null,
    qsa,
    emails,
    telefones,
    alertas: [],
  }
}

function normalizeFallback(
  cnpj14: string,
  d: NonNullable<Awaited<ReturnType<typeof fetchCnpjFallback>>>,
  m: PersonMembership,
): EmpresaNormalizada {
  return {
    cnpj14,
    nome: d.nome ?? m.company?.name ?? null,
    nomeFantasia: d.nomeFantasia ?? null,
    situacao: d.situacao ?? null,
    dataSituacao: null,
    abertura: null,
    capital: d.capital ?? (typeof m.company?.equity === 'number' ? m.company.equity : null),
    cnae: null,
    natureza: m.company?.nature?.text ?? null,
    porte: m.company?.size?.text ?? null,
    cargo: m.role?.text ?? null,
    dataEntrada: m.since ?? null,
    endereco: d.endereco ?? null,
    email: d.email ?? null,
    telefone: d.telefone ?? null,
    qsa: [],
    emails: d.email ? [d.email] : [],
    telefones: d.telefone ? [d.telefone] : [],
    alertas: ['dados parciais (fallback scrape)'],
  }
}

// Mantém o nome do field como "cpfMasked" por compatibilidade, mas
// agora exibimos o CPF completo formatado.
const maskCpf = formatCpf

type AddressParts = {
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cep?: string | null
}

function normalizeAddrField(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[.,/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeAddressKey(p: AddressParts): string | null {
  const log = normalizeAddrField(p.logradouro)
  const num = normalizeAddrField(p.numero)
  const bai = normalizeAddrField(p.bairro)
  const cep = (p.cep ?? '').replace(/\D/g, '')
  // Endereço só conta como chave se tiver logradouro+CEP — evita "sem número" agrupando empresas.
  if (!log || !cep) return null
  return `${log}|${num}|${bai}|${cep}`
}
