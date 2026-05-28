import { callClaude, extractText, ClaudeError } from '../apis/claude.js'
import { config } from '../config.js'
import type { Block2Processo } from './block2.js'

/**
 * Block 3: pra cada processo com comunicados, manda o histórico ao Claude
 * e pede uma análise focada em recuperação patrimonial.
 *
 * O system prompt é fixo entre processos → cacheado (cache_control: ephemeral)
 * → reduz custo em ~90% das chamadas após a primeira.
 */

const SYSTEM_PROMPT = `Você é um analista de inteligência patrimonial atuando em investigações de bens, dívidas e responsabilidade civil/penal. Receberá os comunicados de um processo judicial e deve produzir um resumo em português, em 1 parágrafo curto (até 80 palavras), focado EXCLUSIVAMENTE em informações úteis para a investigação patrimonial:

- Penhoras, arrestos, sequestros, bloqueios judiciais (BACEN-JUD/SISBAJUD, Renajud, CNIB).
- Condenações com valor; execuções fiscais, trabalhistas, cíveis com valor mencionado.
- Bens identificados (imóveis, veículos, valores, ações, cotas, semoventes).
- Indícios de fraude à execução, sucessão patrimonial, blindagem (testa de ferro, off-shore).
- Garantias prestadas/levantadas (caução, fiança, seguro garantia).
- Andamento processual relevante (sentença, acórdão, trânsito em julgado, falência, recuperação).

Regras: NUNCA invente fatos. Se nada relevante para patrimônio aparecer, responda exatamente "Sem dados patrimoniais relevantes." Não cite datas, números de processo, partes ou advogados — só o que importa para o investigador. Tom: telegráfico, jurídico, objetivo.`

export type Block3Logger = { info: (m: string) => void; warn: (m: string) => void }

export type Block3Result = {
  analises: Map<string, string> // chave: numero do processo
  erros: number
  cacheReads: number
  cacheWrites: number
}

export async function runBlock3(
  processos: Block2Processo[],
  logger?: Block3Logger,
  onProgress?: (atual: number, total: number) => Promise<void>,
): Promise<Block3Result> {
  const result: Block3Result = {
    analises: new Map(),
    erros: 0,
    cacheReads: 0,
    cacheWrites: 0,
  }

  const elegiveis = processos.filter((p) => p.comunicacoes && p.comunicacoes.length > 0)
  const total = elegiveis.length
  if (total === 0) {
    logger?.info('[block3] nenhum processo com comunicados — pulando')
    return result
  }

  logger?.info(`[block3] iniciando — ${total} processo(s) elegíveis, modelo=${config.CLAUDE_MODEL}`)

  for (let i = 0; i < total; i++) {
    const p = elegiveis[i]
    await onProgress?.(i + 1, total)
    try {
      const userText = formatComunicados(p)
      const res = await callClaude({
        model: config.CLAUDE_MODEL,
        max_tokens: 350,
        temperature: 0,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userText }],
      })
      result.cacheReads += res.usage.cache_read_input_tokens ?? 0
      result.cacheWrites += res.usage.cache_creation_input_tokens ?? 0
      const text = extractText(res)
      if (text) result.analises.set(p.numero, text)
    } catch (err) {
      result.erros++
      const msg = err instanceof ClaudeError ? `${err.status} ${err.message}` : (err as Error).message
      logger?.warn(`[block3] processo ${p.numero}: falhou — ${msg}`)
    }
  }

  logger?.info(
    `[block3] concluído — ${result.analises.size}/${total} analisados · erros=${result.erros} ` +
      `cache_reads=${result.cacheReads} cache_writes=${result.cacheWrites}`,
  )
  return result
}

function formatComunicados(p: Block2Processo): string {
  const linhas = p.comunicacoes.map((c, idx) => {
    const data = c.data ?? 's/data'
    const tipo = c.tipo ?? 's/tipo'
    return `[${idx + 1}] ${data} · ${tipo}\n${c.texto}`
  })
  return [
    `Processo: ${p.numero}`,
    p.classe ? `Classe: ${p.classe}` : null,
    p.tribunal ? `Tribunal: ${p.tribunal}` : null,
    '',
    'Comunicados (ordem cronológica decrescente):',
    '',
    ...linhas,
  ]
    .filter((x): x is string => x !== null)
    .join('\n')
}
