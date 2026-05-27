import {
  searchPersonByName,
  getPersonProfile,
  resolveFullCnpjFromRoot,
  type PersonMembership,
} from '../apis/cnpja-bff.js'
import { fetchCnpj, type BrasilApiCnpj } from '../apis/brasilapi.js'
import { fetchCnpjFallback } from '../apis/cnpjbiz.js'
import {
  fetchCnpjOpen,
  formatPhone,
  formatPhoneFromBrasilApi,
  type CnpjaOpenOffice,
} from '../apis/cnpja.js'
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
  _logger?: { warn: (m: string) => void },
): Promise<Block1Result> {
  const warnings: string[] = []

  // Etapa 1: nome → person.id (com validação anti-homônimo por CPF parcial)
  const person = await searchPersonByName(nome, cpf)

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

  // Etapa 2: person.id → membership[]
  const profile = await getPersonProfile(person.personId)
  if (!profile?.membership || profile.membership.length === 0) {
    warnings.push('Pessoa identificada mas sem empresas vinculadas (membership vazio).')
    return { uuid: person.personId, cpfMasked: maskCpf(cpf), totalCapital: 0, empresas: [], warnings }
  }

  // Etapa 3: para cada empresa, resolve raiz → CNPJ14
  const total = profile.membership.length
  const empresas: EmpresaNormalizada[] = []
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

    // BrasilAPI (situação/capital/QSA/endereço) + CNPJa Open (e-mails, telefones)
    // em paralelo. CNPJa Open passa por fila pra respeitar rate limit.
    const [detail, cnpjaOpen] = await Promise.all([fetchCnpj(cnpj14), fetchCnpjOpen(cnpj14)])
    let scrape: Awaited<ReturnType<typeof fetchCnpjFallback>> | null = null
    if (!detail && !cnpjaOpen) scrape = await fetchCnpjFallback(cnpj14)

    let normalized: EmpresaNormalizada
    if (detail) {
      normalized = normalizeBrasilApi(cnpj14, detail, nome, m)
    } else if (cnpjaOpen) {
      normalized = normalizeCnpjaOpen(cnpj14, cnpjaOpen, nome, m)
    } else if (scrape) {
      normalized = normalizeFallback(cnpj14, scrape, m)
    } else {
      normalized = blankEmpresa(cnpj14, m, ['dados não localizados'])
    }

    // CNPJa Open quase sempre tem e-mails/telefones que BrasilAPI não tem.
    // Mescla por cima sem perder dados estruturais da fonte primária.
    if (cnpjaOpen) {
      const emailsOpen = (cnpjaOpen.emails ?? [])
        .map((e) => e.address?.trim())
        .filter((s): s is string => !!s)
      const phonesOpen = (cnpjaOpen.phones ?? [])
        .map((p) => formatPhone(p.area, p.number))
        .filter((s): s is string => !!s)
      if (emailsOpen.length > 0) normalized.emails = uniq(emailsOpen)
      if (phonesOpen.length > 0) normalized.telefones = uniq(phonesOpen)
      normalized.email = normalized.emails[0] ?? normalized.email
      normalized.telefone = normalized.telefones[0] ?? normalized.telefone
    }

    if (normalized.capital) totalCapital += Number(normalized.capital)
    empresas.push(normalized)
  }

  // Alertas de cruzamento
  const emailCount = new Map<string, number>()
  for (const e of empresas) if (e.email) emailCount.set(e.email.toLowerCase(), (emailCount.get(e.email.toLowerCase()) ?? 0) + 1)
  for (const e of empresas) {
    if (e.email && (emailCount.get(e.email.toLowerCase()) ?? 0) > 1) {
      e.alertas.push(`email compartilhado em ${emailCount.get(e.email.toLowerCase())} empresas`)
    }
    if (e.email && PESSOAL_DOMAIN_RX.test(e.email) && (e.capital ?? 0) >= CAPITAL_ALTO) {
      e.alertas.push('email pessoal em empresa de alto capital')
    }
  }

  return { uuid: person.personId, cpfMasked: maskCpf(cpf), totalCapital, empresas, warnings }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
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

function normalizeBrasilApi(
  cnpj14: string,
  d: BrasilApiCnpj,
  nomeAlvo: string,
  m: PersonMembership,
): EmpresaNormalizada {
  const enderecoParts = [d.logradouro, d.numero, d.bairro, d.municipio, d.uf, d.cep].filter(Boolean)
  const capitalRaw = typeof d.capital_social === 'string' ? Number(d.capital_social) : (d.capital_social ?? null)
  const capital = Number.isFinite(capitalRaw as number) ? (capitalRaw as number) : null
  const qsa = (d.qsa ?? []).map((q) => ({
    nome_socio: q.nome_socio,
    qualificacao_socio: q.qualificacao_socio,
    data_entrada_sociedade: q.data_entrada_sociedade,
    faixa_etaria: q.faixa_etaria,
  }))
  const socioAlvo = qsa.find((q) => q.nome_socio?.toUpperCase() === nomeAlvo.toUpperCase())
  const telefones = [d.ddd_telefone_1, d.ddd_telefone_2]
    .map((p) => formatPhoneFromBrasilApi(p))
    .filter((s): s is string => !!s)
  const emails = d.email ? [d.email] : []
  return {
    cnpj14,
    nome: d.razao_social ?? null,
    nomeFantasia: d.nome_fantasia ?? null,
    situacao: d.descricao_situacao_cadastral ?? null,
    dataSituacao: d.data_situacao_cadastral ?? null,
    abertura: d.data_inicio_atividade ?? null,
    capital,
    cnae: d.cnae_fiscal ? `${d.cnae_fiscal} ${d.cnae_fiscal_descricao ?? ''}`.trim() : null,
    natureza: d.natureza_juridica ?? m.company?.nature?.text ?? null,
    porte: d.porte ?? m.company?.size?.text ?? null,
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

function normalizeCnpjaOpen(
  cnpj14: string,
  d: CnpjaOpenOffice,
  nomeAlvo: string,
  m: PersonMembership,
): EmpresaNormalizada {
  const enderecoParts = [
    d.address?.street,
    d.address?.number,
    d.address?.district,
    d.address?.city,
    d.address?.state,
    d.address?.zip,
  ].filter(Boolean)
  const capitalRaw = typeof d.company?.equity === 'string' ? Number(d.company.equity) : (d.company?.equity ?? null)
  const capital = Number.isFinite(capitalRaw as number) ? (capitalRaw as number) : null
  const qsa = (d.members ?? []).map((mb) => ({
    nome_socio: mb.person?.name,
    qualificacao_socio: mb.role?.text,
    data_entrada_sociedade: mb.since,
    faixa_etaria: mb.age,
  }))
  const socioAlvo = qsa.find((q) => q.nome_socio?.toUpperCase() === nomeAlvo.toUpperCase())
  const emails = uniq(
    (d.emails ?? []).map((e) => e.address?.trim()).filter((s): s is string => !!s),
  )
  const telefones = uniq(
    (d.phones ?? []).map((p) => formatPhone(p.area, p.number)).filter((s): s is string => !!s),
  )
  return {
    cnpj14,
    nome: d.company?.name ?? null,
    nomeFantasia: d.alias ?? null,
    situacao: d.status?.text ?? null,
    dataSituacao: d.statusDate ?? null,
    abertura: d.founded ?? null,
    capital,
    cnae: d.mainActivity?.id ? `${d.mainActivity.id} ${d.mainActivity.text ?? ''}`.trim() : null,
    natureza: d.company?.nature?.text ?? m.company?.nature?.text ?? null,
    porte: d.company?.size?.text ?? m.company?.size?.text ?? null,
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
