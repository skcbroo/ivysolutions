/**
 * Padronização PT-BR dos dados do ICIJ Offshore Leaks. A API devolve tudo em
 * inglês/no formato da fonte (categorias, status, jurisdições, datas tipo
 * "17-JUL-2012"). Normalizamos na ingestão para o dossiê ficar 100% em PT-BR.
 * Sempre com fallback ao valor original — nunca perde informação.
 */

const CATEGORIA: Record<string, string> = {
  officer: 'Pessoa (officer)',
  entity: 'Empresa offshore',
  intermediary: 'Intermediário',
  address: 'Endereço',
  other: 'Outro',
}

const STATUS: Record<string, string> = {
  active: 'Ativa',
  defaulted: 'Inadimplente',
  'struck off': 'Baixada',
  'struck / off': 'Baixada',
  dissolved: 'Dissolvida',
  inactive: 'Inativa',
  resigned: 'Renunciou',
  liquidated: 'Liquidada',
  'in liquidation': 'Em liquidação',
  'changed agent': 'Trocou de agente',
}

/** Jurisdições offshore mais comuns no acervo ICIJ (código e nome em inglês). */
const JURISDICAO: Record<string, string> = {
  bvi: 'Ilhas Virgens Britânicas',
  'british virgin islands': 'Ilhas Virgens Britânicas',
  pan: 'Panamá',
  panama: 'Panamá',
  bah: 'Bahamas',
  bahamas: 'Bahamas',
  cayman: 'Ilhas Cayman',
  'cayman islands': 'Ilhas Cayman',
  sey: 'Seicheles',
  seychelles: 'Seicheles',
  bze: 'Belize',
  belize: 'Belize',
  niue: 'Niue',
  samoa: 'Samoa',
  anguilla: 'Anguila',
  jersey: 'Jersey',
  guernsey: 'Guernsey',
  'isle of man': 'Ilha de Man',
  malta: 'Malta',
  cyprus: 'Chipre',
  'hong kong': 'Hong Kong',
  singapore: 'Singapura',
  switzerland: 'Suíça',
  luxembourg: 'Luxemburgo',
  liechtenstein: 'Liechtenstein',
  'united kingdom': 'Reino Unido',
  'united states': 'Estados Unidos',
  uruguay: 'Uruguai',
  'costa rica': 'Costa Rica',
  nevada: 'Nevada (EUA)',
  wyoming: 'Wyoming (EUA)',
  delaware: 'Delaware (EUA)',
  brazil: 'Brasil',
}

const MESES: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

const lookup = (map: Record<string, string>, v: string | null | undefined): string | null => {
  if (!v) return v ?? null
  return map[v.trim().toLowerCase()] ?? v
}

export const categoriaPt = (v: string | null | undefined) => lookup(CATEGORIA, v)
export const statusPt = (v: string | null | undefined) => lookup(STATUS, v)
export const jurisdicaoPt = (v: string | null | undefined) => lookup(JURISDICAO, v)

/** "17-JUL-2012" → "17/07/2012"; "2012" → "2012"; fallback ao original. */
export function dataPt(v: string | null | undefined): string | null {
  if (!v) return v ?? null
  const m = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(v.trim())
  if (m) {
    const mes = MESES[m[2].toUpperCase()]
    if (mes) return `${m[1].padStart(2, '0')}/${mes}/${m[3]}`
  }
  return v
}
