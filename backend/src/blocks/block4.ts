import { matchPerson, OpenSanctionsError, type OpenSanctionsResult } from '../apis/opensanctions.js'
import {
  searchOfficers,
  getOfficerAppointments,
  UkCompaniesError,
  type UkOfficerSearchItem,
  type UkAppointment,
} from '../apis/ukcompanies.js'

/**
 * Block 4: buscas internacionais. Produz dados ESTRUTURADOS para serem
 * costurados ao dossiê (não uma aba isolada):
 *  - `sancoes`         → flag de risco no topo (OpenSanctions: sanções/PEP).
 *  - `empresasExterior`→ entram na lista de empresas + linha do tempo (Companies House).
 */

export const MATCH_SCORE_THRESHOLD = 0.7

/** Nº máximo de officers do Companies House a detalhar (limita chamadas). */
const UK_MAX_OFFICERS = 3

export type Block4Logger = { info: (m: string) => void; warn: (m: string) => void }

/** Hit de risco sobre a pessoa (OpenSanctions). */
export type Sancao = {
  entidade: string
  score: number
  match: boolean
  paises: string[]
  programas: string[]
  listas: string[]
  aliases: string[]
  url: string | null
}

/** Sociedade no exterior (uma nomeação do Companies House). */
export type EmpresaExterior = {
  officer: string
  empresa: string
  numero: string | null
  jurisdicao: string
  cargo: string | null
  entrada: string | null
  saida: string | null
  url: string | null
  score: number
}

export type Block4Result = {
  sancoes: Sancao[]
  empresasExterior: EmpresaExterior[]
  erros: number
}

const uniq = (arr: string[]) => [...new Set(arr.filter((s) => s && s.length > 0))]

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/* ── OpenSanctions → Sancao ── */

function toSancao(r: OpenSanctionsResult): Sancao {
  const p = r.properties ?? {}
  return {
    entidade: r.caption,
    score: r.score,
    match: r.match,
    paises: uniq([...(p.country ?? []), ...(p.nationality ?? [])]),
    programas: uniq([...(p.program ?? []), ...(p.topics ?? [])]),
    listas: r.datasets ?? [],
    aliases: uniq(p.alias ?? []),
    url: r.id ? `https://www.opensanctions.org/entities/${r.id}/` : null,
  }
}

async function runOpenSanctions(nome: string, logger?: Block4Logger): Promise<Sancao[]> {
  const candidatos = await matchPerson(nome)
  const relevantes = candidatos.filter((c) => c.match || c.score >= MATCH_SCORE_THRESHOLD)
  logger?.info(
    `[block4] OpenSanctions — ${candidatos.length} candidato(s), ${relevantes.length} acima do corte`,
  )
  return relevantes.map(toSancao)
}

/* ── UK Companies House → EmpresaExterior[] ── */

/** Só considera officer cujo nome contém todos os tokens do alvo (corta homônimos frouxos). */
function ukNameScore(alvo: string, officerTitle: string): number {
  const a = normalize(alvo)
  const o = normalize(officerTitle)
  if (a === o) return 1
  const tokens = a.split(' ').filter((t) => t.length > 1)
  return tokens.every((t) => o.includes(t)) ? 0.85 : 0
}

function companyUrl(numero: string | null, selfLink: string | undefined): string | null {
  const HOST = 'https://find-and-update.company-information.service.gov.uk'
  if (numero) return `${HOST}/company/${numero}`
  if (selfLink) return `${HOST}${selfLink.replace(/\/appointments$/, '')}`
  return null
}

function toEmpresasExterior(
  officer: UkOfficerSearchItem,
  apps: UkAppointment[],
  score: number,
): EmpresaExterior[] {
  return apps
    .filter((a) => a.appointed_to?.company_name)
    .map((a) => ({
      officer: officer.title,
      empresa: a.appointed_to!.company_name!,
      numero: a.appointed_to?.company_number ?? null,
      jurisdicao: 'GB',
      cargo: a.officer_role ?? null,
      entrada: a.appointed_on ?? null,
      saida: a.resigned_on ?? null,
      url: companyUrl(a.appointed_to?.company_number ?? null, officer.links?.self),
      score,
    }))
}

async function runUkCompanies(nome: string, logger?: Block4Logger): Promise<EmpresaExterior[]> {
  const officers = await searchOfficers(nome)
  const matched = officers
    .map((o) => ({ o, score: ukNameScore(nome, o.title) }))
    .filter((x) => x.score > 0)
    .slice(0, UK_MAX_OFFICERS)

  const out: EmpresaExterior[] = []
  for (const { o, score } of matched) {
    const apps = o.links?.self ? await getOfficerAppointments(o.links.self) : []
    out.push(...toEmpresasExterior(o, apps, score))
  }
  logger?.info(
    `[block4] Companies House — ${officers.length} officer(s), ${matched.length} com match · ${out.length} sociedade(s)`,
  )
  return out
}

/* ── Orquestração ── */

export type Block4Opcoes = { opensanctions: boolean; companiesHouse: boolean }

export async function runBlock4(
  nome: string,
  opcoes: Block4Opcoes,
  logger?: Block4Logger,
  onProgress?: (atual: number, total: number) => Promise<void>,
): Promise<Block4Result> {
  const result: Block4Result = { sancoes: [], empresasExterior: [], erros: 0 }

  type Fonte = { nome: string; run: () => Promise<void> }
  const fontes: Fonte[] = []
  if (opcoes.opensanctions) {
    fontes.push({
      nome: 'OpenSanctions',
      run: async () => {
        result.sancoes.push(...(await runOpenSanctions(nome, logger)))
      },
    })
  }
  if (opcoes.companiesHouse) {
    fontes.push({
      nome: 'Companies House',
      run: async () => {
        result.empresasExterior.push(...(await runUkCompanies(nome, logger)))
      },
    })
  }

  logger?.info(`[block4] iniciando — ${fontes.length} fonte(s) para "${nome}"`)
  const total = fontes.length
  await onProgress?.(0, total)

  for (let i = 0; i < fontes.length; i++) {
    const f = fontes[i]
    try {
      await f.run()
    } catch (err) {
      result.erros++
      const msg =
        err instanceof OpenSanctionsError || err instanceof UkCompaniesError
          ? `${err.status} ${err.message}`
          : (err as Error).message
      logger?.warn(`[block4] ${f.nome} falhou — ${msg}`)
    }
    await onProgress?.(i + 1, total)
  }

  logger?.info(
    `[block4] concluído — ${result.sancoes.length} sanção(ões), ${result.empresasExterior.length} sociedade(s) ext · erros=${result.erros}`,
  )
  return result
}
