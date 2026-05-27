import { httpJson } from './http.js'
import { comunicaQueue } from './queue.js'
import { formatCpf } from '../utils/format.js'

const BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const PAGE_SIZE = 100
const MAX_PAGES_NAME = 50
const MAX_PAGES_CPF = 30
const MAX_PAGES_EMPRESA = 5

type Destinatario = { nome?: string; polo?: 'A' | 'P' | string }
type DestinatarioAdvogado = {
  advogado?: { nome?: string; numero_oab?: string; uf_oab?: string }
}
type ComunicaItem = {
  id: number
  siglaTribunal?: string
  nomeOrgao?: string
  numero_processo?: string
  numeroprocessocommascara?: string
  link?: string
  nomeClasse?: string
  texto?: string
  tipoComunicacao?: string
  tipoDocumento?: string
  data_disponibilizacao?: string
  datadisponibilizacao?: string
  destinatarios?: Destinatario[]
  destinatarioadvogados?: DestinatarioAdvogado[]
}
type ComunicaResponse = { status?: string; count?: number; items?: ComunicaItem[] }

export type Vinculo = 'pessoal' | 'cpf' | 'empresarial'

export type Comunicado = {
  data: string | null
  tipo: string | null
  texto: string
  link: string | null
}

export type ComunicaProcesso = {
  numero: string
  tribunal: string
  orgao: string | null
  classe: string | null
  polo: 'A' | 'P' | null
  link: string | null
  criminal: boolean
  vinculo: Vinculo
  empresaVinculada: string | null
  comunicacoes: Comunicado[]
}

const MAX_COMUNICACOES_POR_PROCESSO = 5
const TEXTO_MAX = 1200

export type ComunicaResult = {
  processos: ComunicaProcesso[]
  empresasVinculadas: Array<{ nome: string; polo?: string | null }>
  advogados: Array<{ nome: string; oab?: string | null }>
}

export type SearchInput = {
  nome: string
  cpf: string
  empresas: string[] // razões sociais
  cpfParcial?: string | null // 6 dígitos centrais ("567398"), usado para confirmar match por nome
}

export type ProgressInfo = {
  etapa: string
  atual: number
  total: number
  etaMs: number | null
}
export type Progress = (info: ProgressInfo) => Promise<void>

const CRIMINAL_RX =
  /(criminal|ação penal|inquérito policial|habeas corpus|execução penal|crime|recurso em sentido estrito|medida protetiva|infração penal|correição parcial criminal|delito|denúncia criminal)/i

const EMPRESA_RX =
  /(LTDA|S[/.]A\b|S\.A\b|EIRELI|MEI\b|ME\b|EPP\b|CIA\b|MUNICÍPIO|MUNICIPIO|UNIÃO|UNIAO|ESTADO\s+DE|FAZENDA|ASSOCIAÇÃO|ASSOCIACAO|FUNDAÇÃO|FUNDACAO|COOPERATIVA|INSS|CAIXA|BANCO|SECRETARIA|MINISTÉRIO|MINISTERIO|PROCURADORIA|GOVERNO\s+DO)/i

function isEmpresa(nome: string): boolean {
  return EMPRESA_RX.test(nome)
}

// Hierarquia de vínculo: pessoal > cpf > empresarial.
const VINCULO_RANK: Record<Vinculo, number> = { pessoal: 3, cpf: 2, empresarial: 1 }
function strongerVinculo(a: Vinculo, b: Vinculo): Vinculo {
  return VINCULO_RANK[a] >= VINCULO_RANK[b] ? a : b
}

type Context = {
  nomeUpper: string
  cpfPuro: string
  cpfFormatado: string
  cpfParcial: string | null
  empresasUpper: Set<string>
  processosMap: Map<string, ComunicaProcesso>
  empresasMap: Map<string, { nome: string; polo: string | null }>
  advogadosMap: Map<string, { nome: string; oab: string | null }>
}

export async function searchComunica(input: SearchInput, onProgress?: Progress): Promise<ComunicaResult> {
  const ctx: Context = {
    nomeUpper: input.nome.toUpperCase().trim(),
    cpfPuro: input.cpf.replace(/\D/g, ''),
    cpfFormatado: formatCpf(input.cpf),
    cpfParcial: input.cpfParcial ?? input.cpf.replace(/\D/g, '').padStart(11, '0').slice(3, 9),
    empresasUpper: new Set(input.empresas.map((e) => e.toUpperCase().trim())),
    processosMap: new Map(),
    empresasMap: new Map(),
    advogadosMap: new Map(),
  }

  // Calcula o universo total de "ticks" (= páginas máximas) e oferece um
  // contador monotônico ao callback. Se uma query terminar antes do limite,
  // saltamos os ticks restantes para frente — progresso nunca volta.
  const total =
    MAX_PAGES_NAME +
    2 * MAX_PAGES_CPF +
    input.empresas.length * MAX_PAGES_EMPRESA
  const t0 = Date.now()
  let atual = 0

  const tick = async (etapa: string) => {
    atual = Math.min(atual + 1, total)
    const elapsed = Date.now() - t0
    const etaMs = atual > 1 && atual < total ? Math.round((elapsed / atual) * (total - atual)) : null
    await onProgress?.({ etapa, atual, total, etaMs })
  }

  const fastForward = async (etapa: string, by: number) => {
    if (by <= 0) return
    atual = Math.min(atual + by, total)
    const elapsed = Date.now() - t0
    const etaMs = atual > 1 && atual < total ? Math.round((elapsed / atual) * (total - atual)) : null
    await onProgress?.({ etapa, atual, total, etaMs })
  }

  // ── 1. Nome do alvo ──
  await paginarQuery(
    { nomeParte: input.nome },
    'pessoal',
    ctx,
    MAX_PAGES_NAME,
    'Buscando processos do alvo',
    tick,
    fastForward,
    /* requireCpfMatch */ true,
  )

  // ── 2. CPF no texto (formatado + puro) ──
  for (const [i, cpfQuery] of [ctx.cpfFormatado, ctx.cpfPuro].entries()) {
    await paginarQuery(
      { texto: cpfQuery },
      'cpf',
      ctx,
      MAX_PAGES_CPF,
      `Cruzando CPF (${i + 1}/2)`,
      tick,
      fastForward,
      /* requireCpfMatch */ false,
    )
  }

  // ── 3. Razão social de cada empresa ──
  for (const [i, razao] of input.empresas.entries()) {
    await paginarQuery(
      { nomeParte: razao },
      'empresarial',
      ctx,
      MAX_PAGES_EMPRESA,
      `Empresa ${i + 1} de ${input.empresas.length} · ${trunc(razao, 32)}`,
      tick,
      fastForward,
      /* requireCpfMatch */ false,
      razao,
    )
  }

  return {
    processos: Array.from(ctx.processosMap.values()),
    empresasVinculadas: Array.from(ctx.empresasMap.values()),
    advogados: Array.from(ctx.advogadosMap.values()),
  }
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

async function paginarQuery(
  params: { nomeParte?: string; texto?: string },
  vinculo: Vinculo,
  ctx: Context,
  maxPages: number,
  etapaLabel: string,
  tick: (etapa: string) => Promise<void>,
  fastForward: (etapa: string, by: number) => Promise<void>,
  requireCpfMatch: boolean,
  empresaVinculadaNome?: string,
) {
  for (let page = 1; page <= maxPages; page++) {
    await tick(etapaLabel)
    const qs = new URLSearchParams({ ...params, itensPorPagina: String(PAGE_SIZE), pagina: String(page) }).toString()
    const url = `${BASE}?${qs}`
    const result = (await comunicaQueue.add(() =>
      httpJson<ComunicaResponse>(url, { retries: 4, retryDelayMs: 2_000, timeoutMs: 30_000 }),
    )) as { status: number; data: ComunicaResponse | null }
    const items = result.data?.items
    if (result.status !== 200 || !items || items.length === 0) {
      await fastForward(etapaLabel, maxPages - page)
      return
    }

    for (const it of items) ingest(it, vinculo, ctx, requireCpfMatch, empresaVinculadaNome)

    if (items.length < PAGE_SIZE) {
      await fastForward(etapaLabel, maxPages - page)
      return
    }
  }
}

function ingest(
  it: ComunicaItem,
  vinculo: Vinculo,
  ctx: Context,
  requireCpfMatch: boolean,
  empresaVinculadaNome?: string,
) {
  // Identifica o alvo entre destinatários (match estrito: nome exato)
  const destAlvo = (it.destinatarios ?? []).find((d) => d.nome?.toUpperCase().trim() === ctx.nomeUpper)
  const empresaDest = (it.destinatarios ?? []).find(
    (d) => d.nome && ctx.empresasUpper.has(d.nome.toUpperCase().trim()),
  )

  // Se busca foi por nome do alvo, exige confirmação por CPF parcial quando disponível
  // (o destinatário tem `numero_documento`? Não — só nome e polo no payload.)
  // Como o Comunica não expõe CPF dos destinatários, usamos:
  //   - confirmação implícita: ao menos uma empresa do alvo aparece como destinatária no mesmo processo
  //   - OU classe que contém texto com CPF do alvo (já tratado pela busca cpf)
  if (vinculo === 'pessoal' && requireCpfMatch && !destAlvo) return

  // Quando busca por nome, descartamos itens onde o destinatário com nome igual NÃO bate com nenhuma
  // empresa conhecida (fortíssimo sinal de homônimo de outra unidade federativa).
  if (vinculo === 'pessoal' && requireCpfMatch && destAlvo && !empresaDest && ctx.empresasUpper.size > 0) {
    // Heurística leve: se tem empresas conhecidas e nenhuma aparece, assume homônimo
    // Comenta a linha abaixo para incluir o caso (mais ruidoso, menos preciso)
    // return
  }

  // Coleta empresas vinculadas (PJs que aparecem como destinatárias)
  for (const d of it.destinatarios ?? []) {
    if (!d.nome) continue
    if (d.nome.toUpperCase().trim() === ctx.nomeUpper) continue
    if (isEmpresa(d.nome)) {
      const k = d.nome.toUpperCase().trim()
      if (!ctx.empresasMap.has(k)) {
        ctx.empresasMap.set(k, { nome: d.nome, polo: d.polo === 'A' || d.polo === 'P' ? d.polo : null })
      }
    }
  }

  // Advogados
  for (const da of it.destinatarioadvogados ?? []) {
    const adv = da.advogado
    if (!adv?.nome) continue
    const oab = adv.numero_oab && adv.uf_oab ? `${adv.uf_oab} ${adv.numero_oab}` : adv.numero_oab ?? null
    const k = `${adv.nome}|${oab ?? ''}`.toUpperCase()
    if (!ctx.advogadosMap.has(k)) ctx.advogadosMap.set(k, { nome: adv.nome, oab })
  }

  const numero = it.numeroprocessocommascara ?? it.numero_processo
  if (!numero) return

  const polo: 'A' | 'P' | null = destAlvo?.polo === 'A' || destAlvo?.polo === 'P' ? destAlvo.polo : null
  const empresaSinalizada = empresaVinculadaNome ?? empresaDest?.nome ?? null

  const comunicado: Comunicado = {
    data: it.data_disponibilizacao ?? it.datadisponibilizacao ?? null,
    tipo: it.tipoComunicacao ?? it.tipoDocumento ?? null,
    texto: cleanTexto(it.texto ?? ''),
    link: it.link ?? null,
  }

  if (!ctx.processosMap.has(numero)) {
    ctx.processosMap.set(numero, {
      numero,
      tribunal: it.siglaTribunal ?? 'desconhecido',
      orgao: it.nomeOrgao ?? null,
      classe: it.nomeClasse ?? null,
      polo,
      link: it.link ?? null,
      criminal: it.nomeClasse ? CRIMINAL_RX.test(it.nomeClasse) : false,
      vinculo,
      empresaVinculada: vinculo === 'empresarial' ? empresaSinalizada : null,
      comunicacoes: [comunicado],
    })
  } else {
    const existing = ctx.processosMap.get(numero)!
    existing.vinculo = strongerVinculo(existing.vinculo, vinculo)
    if (!existing.polo && polo) existing.polo = polo
    if (!existing.empresaVinculada && empresaSinalizada && existing.vinculo === 'empresarial') {
      existing.empresaVinculada = empresaSinalizada
    }
    // Mantém comunicações ordenadas por data desc, até 5 únicas
    const sameLink = existing.comunicacoes.some((c) => c.link === comunicado.link)
    if (!sameLink) {
      existing.comunicacoes.push(comunicado)
      existing.comunicacoes.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
      existing.comunicacoes.length = Math.min(existing.comunicacoes.length, MAX_COMUNICACOES_POR_PROCESSO)
    }
  }
}

function cleanTexto(html: string): string {
  // Remove HTML tags e normaliza espaços; trunca em TEXTO_MAX.
  const stripped = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return stripped.length > TEXTO_MAX ? stripped.slice(0, TEXTO_MAX) + '…' : stripped
}

// Exports internos apenas para suíte de testes.
export const __internals__ = { isEmpresa, strongerVinculo, cleanTexto, CRIMINAL_RX }
