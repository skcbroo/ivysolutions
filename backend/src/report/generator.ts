import type { Block1Result } from '../blocks/block1.js'
import type { Block2Result } from '../blocks/block2.js'
import type { Sancao, EmpresaExterior } from '../blocks/block4.js'
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

export function generateReport(
  nome: string,
  cpf: string,
  b1: Block1Result,
  b2: Block2Result,
  analisesLlm?: Map<string, string> | null,
  internacional?: { sancoes: Sancao[]; empresasExterior: EmpresaExterior[] } | null,
): string {
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
  if (b1.empresas.length === 0) {
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
  if (b2.processos.length === 0) {
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

  linhas.push('## Itens para verificação manual')
  const nomeUrl = encodeURIComponent(nome)
  linhas.push(`- **ARISP (imóveis SP):** https://www.arisp.com.br/`)
  linhas.push(`- **ICIJ Offshore Leaks:** https://offshoreleaks.icij.org/search?q=${nomeUrl}`)
  linhas.push(`- **Florida Sunbiz:** https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?searchNameOrder=${nomeUrl}&aggregateId=&searchTerm=${nomeUrl}&listNameOrder=${nomeUrl}`)
  linhas.push(`- **Miami-Dade ORS:** https://www.miami-dadeclerk.com/ocs/`)
  linhas.push(`- **RENAJUD:** acesso restrito (PJe / judicial)`)

  return linhas.join('\n')
}

function esc(v: string | null | undefined): string {
  if (!v) return '—'
  return v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

