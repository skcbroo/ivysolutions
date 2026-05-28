import type { Empresa, EmpresaExterior, ConexaoOffshore, InvestigacaoFull } from '../../../lib/osint'
import { formatCnpj } from './format'

/**
 * UNIFICAÇÃO DE EMPRESAS — fonte única de verdade.
 *
 * REGRA: toda fonte que traz empresas para o dossiê (Bloco 1 doméstico, UK
 * Companies House, ICIJ Offshore, e QUALQUER API futura) deve ser montada aqui
 * em `unificarEmpresas` e passar por `dedupEmpresas`. Nunca renderize empresas
 * de uma nova fonte direto na aba sem deduplicar — empresas iguais podem vir de
 * APIs diferentes (ex.: a mesma sociedade no UK Companies House e no ICIJ).
 */

export type EmpresaRow = {
  key: string
  exterior: boolean
  jurisdicao: string // 'BR' | 'GB' | label PT (ICIJ)
  ident: string // CNPJ formatado (BR) ou nº de registro (exterior)
  nome: string
  situacao: string | null
  ativa: boolean
  capital: number | null
  cargo: string | null
  periodo: string | null
  alertas: string[]
  emails: string[]
  telefones: string[]
  url: string | null
  /** Fonte(s) de origem — acumula após dedup (ex.: "Reino Unido · ICIJ"). */
  origem: string
}

export const JURIS_LABEL: Record<string, string> = { BR: 'Brasil', GB: 'Reino Unido' }

const ano = (d: string | null) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : d ?? '?')

/** Normaliza nome/identificador para a chave de dedup (sem acento, minúsculo, alfanumérico). */
export function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const INATIVA_RX = /(inadimplent|baixad|dissolvid|inativ|liquidad|struck|defaulted|dissolved|inactive)/i

function brToRow(e: Empresa): EmpresaRow {
  return {
    key: `br-${e.id}`,
    exterior: false,
    jurisdicao: 'BR',
    ident: formatCnpj(e.cnpj14),
    nome: e.nome ?? 'razão social não localizada',
    situacao: e.situacao,
    ativa: !!(e.situacao && /ATIVA/i.test(e.situacao)),
    capital: e.capital == null ? null : Number(e.capital),
    cargo: e.cargo,
    periodo: null,
    alertas: e.alertas ?? [],
    emails: e.emails ?? [],
    telefones: e.telefones ?? [],
    url: null,
    origem: 'Brasil',
  }
}

function extToRow(e: EmpresaExterior, i: number): EmpresaRow {
  return {
    key: `ext-${i}`,
    exterior: true,
    jurisdicao: e.jurisdicao,
    ident: e.numero ?? '—',
    nome: e.empresa,
    situacao: e.saida ? 'Saída registrada' : 'Vínculo ativo',
    ativa: !e.saida,
    capital: null,
    cargo: e.cargo,
    periodo: `${ano(e.entrada)} → ${e.saida ? ano(e.saida) : 'ativo'}`,
    alertas: [],
    emails: [],
    telefones: [],
    url: e.url,
    origem: 'Reino Unido',
  }
}

function offToRow(c: ConexaoOffshore, i: number): EmpresaRow {
  return {
    key: `off-${i}`,
    exterior: true,
    jurisdicao: c.jurisdicao ?? 'Exterior',
    ident: '—',
    nome: c.nome,
    situacao: c.status ?? 'Vínculo offshore',
    ativa: !INATIVA_RX.test(c.status ?? ''),
    capital: null,
    cargo: null,
    periodo: c.incorporacao ? `incorp. ${c.incorporacao}` : null,
    alertas: [],
    emails: [],
    telefones: [],
    url: c.url,
    origem: 'ICIJ',
  }
}

/**
 * Deduplica empresas entre fontes. Chave: BR por CNPJ (`ident`); exterior por
 * nome normalizado (+ número de registro quando houver). Em colisão, mescla as
 * origens e completa campos faltantes — preserva o dado mais rico.
 */
export function dedupEmpresas(rows: EmpresaRow[]): EmpresaRow[] {
  const map = new Map<string, EmpresaRow>()
  for (const r of rows) {
    // BR: dedup por CNPJ. Exterior: por nome normalizado — o nº de registro
    // pode faltar numa fonte (ex.: ICIJ não traz, UK traz), então não entra na
    // chave, senão a mesma empresa em duas APIs não casaria.
    const k = r.exterior ? `ext:${normalizeNome(r.nome)}` : `br:${r.ident}`
    const ex = map.get(k)
    if (!ex) {
      map.set(k, { ...r, alertas: [...r.alertas] })
      continue
    }
    const origens = new Set([...ex.origem.split(' · '), ...r.origem.split(' · ')])
    ex.origem = [...origens].join(' · ')
    ex.url = ex.url ?? r.url
    ex.periodo = ex.periodo ?? r.periodo
    ex.situacao = ex.situacao ?? r.situacao
    ex.cargo = ex.cargo ?? r.cargo
    if (ex.capital == null && r.capital != null) ex.capital = r.capital
    if (ex.ident === '—' && r.ident !== '—') ex.ident = r.ident
    ex.alertas = [...new Set([...ex.alertas, ...r.alertas])]
  }
  return [...map.values()]
}

/** Monta as linhas de empresas de TODAS as fontes e deduplica. */
export function unificarEmpresas(data: InvestigacaoFull): EmpresaRow[] {
  const offEntities = (data.offshore ?? []).flatMap((v) =>
    (v.conexoes ?? []).filter((c) => (c.categoria ?? '').toLowerCase().includes('empresa')),
  )
  const rows: EmpresaRow[] = [
    ...data.empresas.map(brToRow),
    ...(data.empresas_exterior ?? []).map(extToRow),
    ...offEntities.map(offToRow),
  ]
  return dedupEmpresas(rows)
}
