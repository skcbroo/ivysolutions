import { matchPerson, OpenSanctionsError, type OpenSanctionsResult } from '../apis/opensanctions.js'
import {
  searchOfficers,
  getOfficerAppointments,
  UkCompaniesError,
  type UkOfficerSearchItem,
  type UkAppointment,
} from '../apis/ukcompanies.js'
import { config } from '../config.js'

/**
 * Block 4: buscas internacionais. Cada fonte (OpenSanctions, Companies House,
 * e futuramente Offshore Leaks, Sunbiz, Miami-Dade) acrescenta hits à mesma
 * lista. O formato de `Block4Hit` é genérico e a `fonte` distingue a origem.
 */

export const MATCH_SCORE_THRESHOLD = 0.7

/** Nº máximo de officers do Companies House a detalhar (limita chamadas). */
const UK_MAX_OFFICERS = 3

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

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/* ── OpenSanctions ── */

function osToHit(r: OpenSanctionsResult): Block4Hit {
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

async function runOpenSanctions(nome: string, logger?: Block4Logger): Promise<Block4Hit[]> {
  const candidatos = await matchPerson(nome)
  const relevantes = candidatos.filter((c) => c.match || c.score >= MATCH_SCORE_THRESHOLD)
  logger?.info(
    `[block4] OpenSanctions — ${candidatos.length} candidato(s), ${relevantes.length} acima do corte`,
  )
  return relevantes.map(osToHit)
}

/* ── UK Companies House ── */

/** Só considera officer cujo nome contém todos os tokens do alvo (corta homônimos frouxos). */
function ukNameScore(alvo: string, officerTitle: string): number {
  const a = normalize(alvo)
  const o = normalize(officerTitle)
  if (a === o) return 1
  const tokens = a.split(' ').filter((t) => t.length > 1)
  return tokens.every((t) => o.includes(t)) ? 0.85 : 0
}

function ukToHit(officer: UkOfficerSearchItem, apps: UkAppointment[], score: number): Block4Hit {
  const empresas = uniq(
    apps.map((a) => {
      const nome = a.appointed_to?.company_name
      const num = a.appointed_to?.company_number
      return nome ? `${nome}${num ? ` (${num})` : ''}` : ''
    }),
  )
  const cargos = uniq(apps.map((a) => a.officer_role ?? ''))
  const selfLink = officer.links?.self ?? ''
  return {
    fonte: 'uk_companies',
    entidade: officer.title,
    score,
    match: true,
    paises: ['gb'],
    programas: cargos,
    aliases: [],
    datasets: empresas,
    url: selfLink
      ? `https://find-and-update.company-information.service.gov.uk${selfLink.replace(/\/appointments$/, '')}`
      : null,
  }
}

async function runUkCompanies(nome: string, logger?: Block4Logger): Promise<Block4Hit[]> {
  const officers = await searchOfficers(nome)
  const matched = officers
    .map((o) => ({ o, score: ukNameScore(nome, o.title) }))
    .filter((x) => x.score > 0)
    .slice(0, UK_MAX_OFFICERS)

  const hits: Block4Hit[] = []
  for (const { o, score } of matched) {
    const apps = o.links?.self ? await getOfficerAppointments(o.links.self) : []
    hits.push(ukToHit(o, apps, score))
  }
  logger?.info(
    `[block4] Companies House — ${officers.length} officer(s), ${matched.length} com match de nome`,
  )
  return hits
}

/* ── Orquestração ── */

export async function runBlock4(
  nome: string,
  logger?: Block4Logger,
  onProgress?: (atual: number, total: number) => Promise<void>,
): Promise<Block4Result> {
  const result: Block4Result = { hits: [], erros: 0 }

  const fontes: Array<{ nome: string; run: () => Promise<Block4Hit[]> }> = [
    { nome: 'OpenSanctions', run: () => runOpenSanctions(nome, logger) },
  ]
  if (config.UK_COMPANIES_API_KEY) {
    fontes.push({ nome: 'Companies House', run: () => runUkCompanies(nome, logger) })
  }

  logger?.info(`[block4] iniciando — ${fontes.length} fonte(s) para "${nome}"`)
  const total = fontes.length
  await onProgress?.(0, total)

  for (let i = 0; i < fontes.length; i++) {
    const f = fontes[i]
    try {
      result.hits.push(...(await f.run()))
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

  logger?.info(`[block4] concluído — ${result.hits.length} hit(s) · erros=${result.erros}`)
  return result
}
