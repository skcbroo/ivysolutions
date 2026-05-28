import { z } from 'zod'
import { config } from './config.js'

/**
 * Opções de escopo escolhidas pelo usuário no formulário. B1 (Sociedades)
 * é a base e sempre roda — não é opcional. As dependências entre blocos são
 * resolvidas em `resolverPlano`:
 *   B2 Processos → depende do B1 (sempre presente)
 *   B3 Análise LLM → DEPENDE do B2 (analisa as comunicações dos processos)
 *   B4 Internacional → INDEPENDENTE (só precisa do nome); roda em paralelo
 */
export type Opcoes = {
  processos: boolean
  analiseLlm: boolean
  internacional: { opensanctions: boolean; companiesHouse: boolean; icij: boolean }
}

export const DEFAULT_OPCOES: Opcoes = {
  processos: true,
  analiseLlm: true,
  internacional: { opensanctions: true, companiesHouse: true, icij: true },
}

/** Schema tolerante: campos ausentes assumem o default (tudo ligado). */
export const OpcoesSchema = z
  .object({
    processos: z.boolean().default(true),
    analiseLlm: z.boolean().default(true),
    internacional: z
      .object({
        opensanctions: z.boolean().default(true),
        companiesHouse: z.boolean().default(true),
        icij: z.boolean().default(true),
      })
      .default({ opensanctions: true, companiesHouse: true, icij: true }),
  })
  .default(DEFAULT_OPCOES)

/** O que está disponível globalmente (depende de flags/chaves no ambiente). */
export type Capabilities = {
  processos: boolean
  analiseLlm: boolean
  internacional: boolean
  opensanctions: boolean
  companiesHouse: boolean
  icij: boolean
}

export function capabilities(): Capabilities {
  return {
    processos: true,
    analiseLlm: config.BLOCK3_ENABLED && !!config.ANTHROPIC_API_KEY,
    internacional: config.BLOCK4_ENABLED,
    opensanctions: config.BLOCK4_ENABLED,
    companiesHouse: config.BLOCK4_ENABLED && !!config.UK_COMPANIES_API_KEY,
    // ICIJ usa API pública sem chave — basta o Block 4 estar habilitado.
    icij: config.BLOCK4_ENABLED,
  }
}

/** Plano efetivo = opção do usuário ∧ disponibilidade ∧ dependência. */
export type PlanoExecucao = {
  processos: boolean
  analiseLlm: boolean
  opensanctions: boolean
  companiesHouse: boolean
  icij: boolean
  internacional: boolean
}

export function resolverPlano(op: Opcoes, cap: Capabilities = capabilities()): PlanoExecucao {
  const processos = op.processos && cap.processos
  // B3 depende do B2: sem processos, não há comunicações para analisar.
  const analiseLlm = op.analiseLlm && cap.analiseLlm && processos
  const opensanctions = op.internacional.opensanctions && cap.opensanctions
  const companiesHouse = op.internacional.companiesHouse && cap.companiesHouse
  const icij = op.internacional.icij && cap.icij
  return {
    processos,
    analiseLlm,
    opensanctions,
    companiesHouse,
    icij,
    internacional: opensanctions || companiesHouse || icij,
  }
}
