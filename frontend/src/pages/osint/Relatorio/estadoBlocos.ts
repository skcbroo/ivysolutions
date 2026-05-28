import type { InvestigacaoFull } from '../../../lib/osint'

/**
 * Estado de um bloco/seção do dossiê — distingue "não rodado" (fora do escopo
 * ou bloco que falhou) de "rodou e não achou nada". Usa `opcoes` (escopo
 * escolhido) + `falhas` (blocos que falharam) + `status`.
 */
export type EstadoBloco =
  | { tipo: 'ok' } //            rodou e há resultados
  | { tipo: 'vazio' } //         rodou, nada encontrado
  | { tipo: 'nao_solicitado' } //fora do escopo
  | { tipo: 'falhou' } //        bloco falhou
  | { tipo: 'processando' } //   ainda rodando

type FalhaBloco = 'block1' | 'block2' | 'block3' | 'block4'

const falhou = (d: InvestigacaoFull, bloco: FalhaBloco) =>
  (d.falhas ?? []).some((f) => f.bloco === bloco)

const processando = (d: InvestigacaoFull) => d.status === 'rodando' || d.status === 'pendente'

function resolver(
  d: InvestigacaoFull,
  solicitado: boolean,
  bloco: FalhaBloco,
  temResultado: boolean,
): EstadoBloco {
  if (!solicitado) return { tipo: 'nao_solicitado' }
  if (falhou(d, bloco)) return { tipo: 'falhou' }
  if (temResultado) return { tipo: 'ok' }
  if (processando(d)) return { tipo: 'processando' }
  return { tipo: 'vazio' }
}

// opcoes pode vir vazio/parcial em investigações antigas (default '{}' da
// migration 013) → merge defensivo assumindo escopo completo (legado).
function op(d: InvestigacaoFull) {
  const o = (d.opcoes ?? {}) as Partial<InvestigacaoFull['opcoes']>
  const intl = (o.internacional ?? {}) as Partial<InvestigacaoFull['opcoes']['internacional']>
  return {
    processos: o.processos ?? true,
    analiseLlm: o.analiseLlm ?? true,
    internacional: {
      opensanctions: intl.opensanctions ?? true,
      companiesHouse: intl.companiesHouse ?? true,
      icij: intl.icij ?? true,
    },
  }
}

/** Sociedades (Bloco 1) — sempre roda. */
export const estadoEmpresas = (d: InvestigacaoFull): EstadoBloco =>
  resolver(d, true, 'block1', d.empresas.length > 0)

/** Processos (Bloco 2). */
export const estadoProcessos = (d: InvestigacaoFull): EstadoBloco =>
  resolver(d, op(d).processos, 'block2', d.processos.length > 0)

/** Sanções/PEP (OpenSanctions). */
export const estadoSancoes = (d: InvestigacaoFull): EstadoBloco =>
  resolver(d, op(d).internacional.opensanctions, 'block4', (d.sancoes?.length ?? 0) > 0)

/** Sociedades no exterior (UK Companies House). */
export const estadoExterior = (d: InvestigacaoFull): EstadoBloco =>
  resolver(d, op(d).internacional.companiesHouse, 'block4', (d.empresas_exterior?.length ?? 0) > 0)

/** Vínculos offshore (ICIJ). */
export const estadoOffshore = (d: InvestigacaoFull): EstadoBloco =>
  resolver(d, op(d).internacional.icij, 'block4', (d.offshore?.length ?? 0) > 0)

/** Rótulo curto PT-BR para um estado que não é "ok". */
export function rotuloEstado(e: EstadoBloco): string {
  switch (e.tipo) {
    case 'nao_solicitado':
      return 'Não solicitado'
    case 'falhou':
      return 'Falhou'
    case 'processando':
      return 'Processando…'
    case 'vazio':
      return 'Nada encontrado'
    default:
      return ''
  }
}
