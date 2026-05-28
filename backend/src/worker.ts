export { toDate } from './utils/format.js'
import { runBlock1 } from './blocks/block1.js'
import { runBlock2 } from './blocks/block2.js'
import { runBlock3 } from './blocks/block3.js'
import { runBlock4, type Block4Hit } from './blocks/block4.js'
import { config } from './config.js'
import { generateReport } from './report/generator.js'
import * as investigacoesRepo from './repos/investigacoes.js'
import * as empresasRepo from './repos/empresas.js'
import * as processosRepo from './repos/processos.js'
import * as relatoriosRepo from './repos/relatorios.js'
import * as internacionalRepo from './repos/internacional.js'

type Logger = { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void }

const consoleLogger: Logger = {
  info: (m) => console.log(`[worker] ${m}`),
  warn: (m) => console.warn(`[worker] ${m}`),
  error: (m) => console.error(`[worker] ${m}`),
}

export async function runWorker(investigacaoId: number, logger: Logger = consoleLogger): Promise<void> {
  const inv = await investigacoesRepo.findRunInfo(investigacaoId)
  if (!inv) {
    logger.error(`investigação ${investigacaoId} não encontrada`)
    return
  }

  await investigacoesRepo.setStatus(inv.id, 'rodando')
  logger.info(`#${inv.id} iniciando — ${inv.nome}`)

  try {
    await runWorkerInner(inv, logger)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido'
    logger.error(`#${inv.id} falhou: ${msg}`)
    try {
      await investigacoesRepo.setStatus(inv.id, 'erro', msg)
    } catch (err2) {
      logger.error(`#${inv.id} falha ao registrar erro: ${(err2 as Error).message}`)
    }
    throw err
  }
}

async function runWorkerInner(
  inv: { id: number; nome: string; cpf: string },
  logger: Logger,
): Promise<void> {
  // ── BLOCO 1: Empresas ──
  await investigacoesRepo.setProgresso(inv.id, {
    bloco_atual: 'block1',
    etapa: 'Identificando sociedades do alvo',
    atual: 0,
    total: 1,
    eta_ms: null,
  })
  const b1Inicio = Date.now()
  const b1 = await runBlock1(
    inv.nome,
    inv.cpf,
    async (atual, total) => {
      const elapsed = Date.now() - b1Inicio
      const eta_ms = atual > 0 && atual < total ? Math.round((elapsed / atual) * (total - atual)) : null
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block1',
        etapa: `Empresas do alvo (${atual}/${total})`,
        atual,
        total: Math.max(total, 1),
        eta_ms,
      })
    },
    logger,
  )

  await empresasRepo.bulkInsert(inv.id, b1.empresas)
  await investigacoesRepo.finalizeBlock1(inv.id, {
    uuid: b1.uuid,
    cpfMasked: b1.cpfMasked,
    capitalTotal: b1.totalCapital,
    warnings: b1.warnings ?? [],
  })
  logger.info(`#${inv.id} bloco1 ok — ${b1.empresas.length} empresas`)

  // ── BLOCO 2: Processos ──
  await investigacoesRepo.setProgresso(inv.id, {
    bloco_atual: 'block2',
    etapa: 'Preparando consultas',
    atual: 0,
    total: 1,
    eta_ms: null,
  })
  const empresasNomes = b1.empresas
    .map((e) => e.nome)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  const b2 = await runBlock2(
    {
      nome: inv.nome,
      cpf: inv.cpf,
      empresas: empresasNomes,
      cpfParcial: inv.cpf.replace(/\D/g, '').padStart(11, '0').slice(3, 9),
    },
    async (info) => {
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block2',
        etapa: info.etapa,
        atual: info.atual,
        total: info.total,
        eta_ms: info.etaMs,
      })
    },
    logger,
  )

  await processosRepo.bulkInsert(inv.id, b2.processos)
  await processosRepo.bulkInsertEmpresasVinculadas(inv.id, b2.empresasVinculadas)
  await processosRepo.bulkInsertAdvogados(inv.id, b2.advogados)
  await investigacoesRepo.finalizePjeCount(inv.id, b2.count)
  logger.info(`#${inv.id} bloco2 ok — ${b2.count} processos`)

  // ── BLOCO 3: Análise LLM (opcional, atrás de flag) ──
  let analises: Map<string, string> | null = null
  if (config.BLOCK3_ENABLED && config.ANTHROPIC_API_KEY) {
    await investigacoesRepo.setProgresso(inv.id, {
      bloco_atual: 'block3',
      etapa: 'Analisando comunicados (LLM)',
      atual: 0,
      total: 1,
      eta_ms: null,
    })
    const b3 = await runBlock3(b2.processos, logger, async (atual, total) => {
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block3',
        etapa: `Analisando processos (${atual}/${total})`,
        atual,
        total,
        eta_ms: null,
      })
    })
    analises = b3.analises
    if (analises.size > 0) {
      await processosRepo.updateAnaliseLlm(inv.id, analises)
    }
    logger.info(`#${inv.id} bloco3 ok — ${analises.size} análises`)
  } else {
    logger.info(`#${inv.id} bloco3 pulado (BLOCK3_ENABLED=${config.BLOCK3_ENABLED ? 'true' : 'false'}, ANTHROPIC_API_KEY=${config.ANTHROPIC_API_KEY ? 'set' : 'missing'})`)
  }

  // ── BLOCO 4: Buscas internacionais (opcional, atrás de flag) ──
  let hitsInternacionais: Block4Hit[] = []
  if (config.BLOCK4_ENABLED) {
    await investigacoesRepo.setProgresso(inv.id, {
      bloco_atual: 'block4',
      etapa: 'Buscas internacionais (OpenSanctions)',
      atual: 0,
      total: 1,
      eta_ms: null,
    })
    // Gancho futuro: o Block 1.5 (busca reversa) também dispara o Block 4 ao
    // encontrar empresa correlata com domicílio estrangeiro.
    const b4 = await runBlock4(inv.nome, logger, async (atual, total) => {
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block4',
        etapa: `Buscas internacionais (${atual}/${total})`,
        atual,
        total,
        eta_ms: null,
      })
    })
    hitsInternacionais = b4.hits
    if (hitsInternacionais.length > 0) {
      await internacionalRepo.bulkInsert(inv.id, hitsInternacionais)
    }
    logger.info(`#${inv.id} bloco4 ok — ${hitsInternacionais.length} hit(s)`)
  } else {
    logger.info(`#${inv.id} bloco4 pulado (BLOCK4_ENABLED=false)`)
  }

  // ── RELATÓRIO ──
  const md = generateReport(inv.nome, inv.cpf, b1, b2, analises, hitsInternacionais)
  await relatoriosRepo.upsert(inv.id, md)

  await investigacoesRepo.setStatus(inv.id, 'concluido')
  logger.info(`#${inv.id} concluído`)
}

/**
 * Marca investigações que ficaram em 'rodando' (servidor morreu no meio)
 * como 'erro'. Chamado no boot do servidor.
 */
export async function reapOrphanedRuns(): Promise<void> {
  await investigacoesRepo.reapOrphaned()
}
