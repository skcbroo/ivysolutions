import type { Block1Result } from '../blocks/block1.js'
import type { Block2Result } from '../blocks/block2.js'
import type { Sancao, EmpresaExterior, VinculoOffshore } from '../blocks/block4.js'
import { formatCpf as fmtCpf, formatCnpj } from '../utils/format.js'

const formatBRL = (v: number | null | undefined) =>
  typeof v === 'number'
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—'

function formatDate(raw: string | null | undefined): string {
  if (!raw) return ''
  const m1 = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (m1) return `${m1[3]}/${m1[2]}/${m1[1]}`
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (m2) return raw.slice(0, 10)
  return raw
}

function truncMd(s: string, max: number): string {
  const single = s.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max - 1) + '…' : single
}

/**
 * Metadados de execução: permitem ao relatório distinguir um bloco que rodou e
 * não achou nada ("Nenhum processo encontrado") de um que foi desativado no
 * escopo ou falhou ("Bloco não executado").
 */
export type ReportMeta = {
  plano: { processos: boolean; internacional: boolean }
  falhas: { bloco: string; msg: string }[]
}

export function generateReport(
  nome: string,
  cpf: string,
  b1: Block1Result,
  b2: Block2Result,
  analisesLlm?: Map<string, string> | null,
  internacional?: { sancoes: Sancao[]; empresasExterior: EmpresaExterior[]; offshore?: VinculoOffshore[] } | null,
  meta?: ReportMeta | null,
): string {
  const falhou = (bloco: string) => meta?.falhas.some((f) => f.bloco === bloco) ?? false
  const falhaMsg = (bloco: string) => meta?.falhas.find((f) => f.bloco === bloco)?.msg
  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const linhas: string[] = []

  linhas.push(`# RELATÓRIO INVESTIGATIVO OSINT — ${nome}`)
  linhas.push('')
  linhas.push(`**CPF:** ${fmtCpf(cpf)}`)
  linhas.push(`**Gerado em:** ${date}`)
  if (b1.uuid) linhas.push(`**CNPJa ref:** \`${b1.uuid}\``)
  linhas.push('')

  linhas.push('## Resumo')
  linhas.push(`- Empresas vinculadas: **${b1.empresas.length}**`)
  linhas.push(`- Capital total acumulado: **${formatBRL(b1.totalCapital)}**`)
  linhas.push(`- Processos judiciais: **${b2.count}**`)
  linhas.push(`- Empresas vinculadas em processos: **${b2.empresasVinculadas.length}**`)
  linhas.push(`- Advogados identificados: **${b2.advogados.length}**`)
  linhas.push('')

  linhas.push('## Empresas')
  if (falhou('block1')) {
    linhas.push(`_Bloco não executado: a busca de sociedades falhou (${falhaMsg('block1')})._`)
  } else if (b1.empresas.length === 0) {
    linhas.push('_Nenhuma empresa encontrada._')
  } else {
    linhas.push('| CNPJ | Razão social | Situação | Capital | Cargo | Email | Telefone |')
    linhas.push('|---|---|---|---|---|---|---|')
    for (const e of b1.empresas) {
      linhas.push(
        `| ${formatCnpj(e.cnpj14)} | ${esc(e.nome)} | ${esc(e.situacao)} | ${formatBRL(e.capital)} | ${esc(e.cargo)} | ${esc(e.email)} | ${esc(e.telefone)} |`,
      )
    }
    linhas.push('')

    const alertas = b1.empresas.flatMap((e) => e.alertas.map((a) => `- **${formatCnpj(e.cnpj14)}** ${esc(e.nome)}: ${a}`))
    if (alertas.length > 0) {
      linhas.push('### ⚠ Alertas')
      linhas.push(...alertas)
      linhas.push('')
    }
  }

  linhas.push('## Processos judiciais')
  if (meta && !meta.plano.processos) {
    linhas.push('_Bloco não executado: processos judiciais não foram incluídos no escopo desta investigação._')
  } else if (meta && falhou('block1')) {
    linhas.push('_Bloco não executado: depende das sociedades (Bloco 1), que falhou._')
  } else if (falhou('block2')) {
    linhas.push(`_Bloco não executado: a busca de processos falhou (${falhaMsg('block2')})._`)
  } else if (b2.processos.length === 0) {
    linhas.push('_Nenhum processo encontrado._')
  } else {
    const criminais = b2.processos.filter((p) => p.criminal)
    if (criminais.length > 0) {
      linhas.push(`### ⚠ Criminais (${criminais.length})`)
      for (const p of criminais) {
        linhas.push(`#### ${p.numero}`)
        linhas.push(`*${esc(p.classe)}* — ${p.tribunal}${p.orgao ? ` · ${esc(p.orgao)}` : ''}${p.polo ? ` · polo ${p.polo}` : ''}`)
        if (p.link) linhas.push(`[Abrir no tribunal](${p.link})`)
        const analise = analisesLlm?.get(p.numero)
        if (analise) {
          linhas.push('')
          linhas.push(`**Análise patrimonial:** ${truncMd(analise, 800)}`)
        }
        if (p.comunicacoes && p.comunicacoes.length > 0) {
          linhas.push('')
          linhas.push('**Últimas comunicações:**')
          for (const c of p.comunicacoes.slice(0, 3)) {
            const data = formatDate(c.data)
            const tipo = c.tipo ? ` · ${c.tipo}` : ''
            linhas.push(`- _${data}${tipo}_`)
            if (c.texto) linhas.push(`  > ${truncMd(c.texto, 400)}`)
          }
        }
        linhas.push('')
      }
    }
    linhas.push('### Todos os processos')
    linhas.push('| Número | Tribunal | Classe | Polo | Vínculo |')
    linhas.push('|---|---|---|---|---|')
    for (const p of b2.processos.slice(0, 200)) {
      linhas.push(
        `| ${p.numero} | ${esc(p.tribunal)} | ${esc(p.classe)} | ${esc(p.polo)} | ${esc(p.vinculo ?? '')} |`,
      )
    }
    if (b2.processos.length > 200) linhas.push(`\n_(+${b2.processos.length - 200} processos omitidos do listing)_`)
    linhas.push('')

    // Comunicações: lista as ~50 mais recentes nos cíveis também
    const todasComunicacoes = b2.processos
      .flatMap((p) =>
        (p.comunicacoes ?? []).map((c) => ({ processo: p, c })),
      )
      .filter(({ c }) => c.data)
      .sort((a, b) => (b.c.data ?? '').localeCompare(a.c.data ?? ''))
      .slice(0, 50)

    if (todasComunicacoes.length > 0) {
      linhas.push(`### Últimas ${todasComunicacoes.length} comunicações`)
      for (const { processo, c } of todasComunicacoes) {
        const data = formatDate(c.data)
        const tipo = c.tipo ? ` · ${c.tipo}` : ''
        linhas.push(`- **${data}${tipo}** — ${processo.numero} (${processo.tribunal})`)
        if (c.texto) linhas.push(`  > ${truncMd(c.texto, 300)}`)
      }
      linhas.push('')
    }
  }

  if (b2.advogados.length > 0) {
    linhas.push('## Advogados identificados')
    for (const a of b2.advogados) linhas.push(`- ${a.nome}${a.oab ? ` (OAB ${a.oab})` : ''}`)
    linhas.push('')
  }

  if (b2.empresasVinculadas.length > 0) {
    linhas.push('## Empresas vinculadas em processos')
    for (const e of b2.empresasVinculadas) linhas.push(`- ${e.nome}${e.polo ? ` (polo ${e.polo})` : ''}`)
    linhas.push('')
  }

  const sancoes = internacional?.sancoes ?? []
  const empresasExterior = internacional?.empresasExterior ?? []
  const offshore = internacional?.offshore ?? []

  // Status das buscas internacionais (B4): só quando o bloco foi solicitado.
  if (meta?.plano.internacional) {
    const f4 = falhaMsg('block4')
    const semResultado = sancoes.length === 0 && empresasExterior.length === 0 && offshore.length === 0
    if (f4) {
      linhas.push('## Buscas internacionais')
      linhas.push(
        semResultado
          ? `_Bloco não executado: ${f4}._`
          : `_⚠ Resultado parcial — uma ou mais fontes falharam: ${f4}._`,
      )
      linhas.push('')
    } else if (semResultado) {
      linhas.push('## Buscas internacionais')
      linhas.push('_Nenhum vínculo internacional encontrado._')
      linhas.push('')
    }
  }

  if (sancoes.length > 0) {
    linhas.push('## ⚠ Risco internacional (sanções / PEP)')
    linhas.push(`_Fonte: OpenSanctions — ${sancoes.length} resultado(s) relevante(s)._`)
    linhas.push('')
    for (const s of sancoes) {
      linhas.push(`### ${esc(s.entidade)} (score ${s.score.toFixed(2)})`)
      if (s.programas.length > 0) linhas.push(`- **Categorias/programas:** ${s.programas.join(', ')}`)
      if (s.paises.length > 0) linhas.push(`- **Países:** ${s.paises.join(', ')}`)
      if (s.listas.length > 0) linhas.push(`- **Listas:** ${s.listas.join(', ')}`)
      if (s.aliases.length > 0) linhas.push(`- **Aliases:** ${truncMd(s.aliases.join('; '), 300)}`)
      if (s.url) linhas.push(`- **Detalhe:** ${s.url}`)
      linhas.push('')
    }
  }

  if (empresasExterior.length > 0) {
    linhas.push('## Sociedades no exterior')
    linhas.push('| Empresa | Jurisdição | Cargo | Entrada | Saída | Detalhe |')
    linhas.push('|---|---|---|---|---|---|')
    for (const e of empresasExterior) {
      linhas.push(
        `| ${esc(e.empresa)}${e.numero ? ` (${e.numero})` : ''} | ${esc(e.jurisdicao)} | ${esc(e.cargo)} | ${formatDate(e.entrada)} | ${e.saida ? formatDate(e.saida) : 'ativo'} | ${e.url ?? '—'} |`,
      )
    }
    linhas.push('')
  }

  if (offshore.length > 0) {
    linhas.push('## ⚠ Vínculos offshore (ICIJ Offshore Leaks)')
    linhas.push(`_Fonte: ICIJ — ${offshore.length} vínculo(s) em vazamentos offshore._`)
    linhas.push('')
    linhas.push('| Entidade | Tipo | Dataset | Detalhe |')
    linhas.push('|---|---|---|---|')
    for (const o of offshore) {
      linhas.push(`| ${esc(o.entidade)} | ${esc(o.tipo)} | ${esc(datasetLabel(o.dataset))} | ${o.url ?? '—'} |`)
    }
    linhas.push('')
  }

  linhas.push('## Itens para verificação manual')
  const nomeUrl = encodeURIComponent(nome)
  const sunbizQuery = encodeURIComponent(sunbizInvertido(nome))
  linhas.push(`- **ARISP (imóveis SP):** https://www.arisp.com.br/`)
  if (!meta?.plano.internacional) {
    linhas.push(`- **ICIJ Offshore Leaks:** https://offshoreleaks.icij.org/search?q=${nomeUrl}`)
  }
  // Sunbiz/Miami-Dade ficam como verificação manual: o site ao vivo do Sunbiz
  // está atrás de Cloudflare e o Miami-Dade exige captcha/SPA.
  linhas.push(
    `- **Florida Sunbiz** (officer/registered agent — nome invertido): ` +
      `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults/OfficerRegisteredAgentName/${sunbizQuery}/Page1`,
  )
  for (const v of variacoesNomeInvertido(nome).slice(1)) {
    linhas.push(`  - variação: \`${v}\``)
  }
  linhas.push(`- **Miami-Dade Clerk — Official Records** (Party Name): https://onlineservices.miamidadeclerk.gov/officialrecords/StandardSearch.aspx`)
  for (const v of variacoesNomeInvertido(nome)) {
    linhas.push(`  - testar: \`${v}\``)
  }
  linhas.push(`- **RENAJUD:** acesso restrito (PJe / judicial)`)

  return linhas.join('\n')
}

/** Rótulo legível do dataset do ICIJ (slug → título). */
function datasetLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Inverte o nome para o formato "SOBRENOME NOME" usado por Sunbiz/Miami-Dade
 * (last-name-first, sem acento, maiúsculas). Ex.: "Sidnei de Jesus" → "DE JESUS SIDNEI".
 */
function sunbizInvertido(nome: string): string {
  const tokens = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length < 2) return tokens.join(' ')
  const [primeiro, ...resto] = tokens
  return [...resto, primeiro].join(' ')
}

/** Variações de nome invertido para ampliar recall em bases dos EUA. */
function variacoesNomeInvertido(nome: string): string[] {
  const tokens = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length < 2) return [tokens.join(' ')]
  const [primeiro, ...resto] = tokens
  const ultimo = resto[resto.length - 1]
  return [...new Set([
    [...resto, primeiro].join(' '), // DE JESUS SIDNEI
    `${ultimo} ${primeiro}`, // JESUS SIDNEI
    `${primeiro} ${resto.join(' ')}`, // SIDNEI DE JESUS
  ])]
}

function esc(v: string | null | undefined): string {
  if (!v) return '—'
  return v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

