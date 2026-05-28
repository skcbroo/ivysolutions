export { toDate } from './utils/format.js'
import { runBlock1, type Block1Result } from './blocks/block1.js'
import { runBlock2, type Block2Result } from './blocks/block2.js'
import { runBlock3 } from './blocks/block3.js'
import { runBlock4, type Sancao, type EmpresaExterior, type VinculoOffshore } from './blocks/block4.js'
import { generateReport } from './report/generator.js'
import { OpcoesSchema, resolverPlano } from './opcoes.js'
import * as investigacoesRepo from './repos/investigacoes.js'
import type { Falha } from './repos/investigacoes.js'
import * as empresasRepo from './repos/empresas.js'
import * as processosRepo from './repos/processos.js'
import * as relatoriosRepo from './repos/relatorios.js'
import * as internacionalRepo from './repos/internacional.js'

const EMPTY_B1: Block1Result = { uuid: null, cpfMasked: null, totalCapital: 0, empresas: [], warnings: [] }
const EMPTY_B2: Block2Result = { processos: [], empresasVinculadas: [], advogados: [], count: 0 }

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'erro desconhecido')

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
    // Salvaguarda: o inner isola falhas por bloco, então isto cobre só erros
    // inesperados (ex.: persistência/conexão).
    const msg = errMsg(err)
    logger.error(`#${inv.id} falhou: ${msg}`)
    try {
      await investigacoesRepo.setStatus(inv.id, 'erro', msg)
    } catch (err2) {
      logger.error(`#${inv.id} falha ao registrar erro: ${errMsg(err2)}`)
    }
    throw err
  }
}

async function runWorkerInner(
  inv: { id: number; nome: string; cpf: string; opcoes: unknown },
  logger: Logger,
): Promise<void> {
  const opcoes = OpcoesSchema.parse(inv.opcoes ?? {})
  const plano = resolverPlano(opcoes)
  const falhas: Falha[] = []
  logger.info(
    `#${inv.id} plano: processos=${plano.processos} llm=${plano.analiseLlm} ` +
      `opensanctions=${plano.opensanctions} companiesHouse=${plano.companiesHouse}`,
  )

  // ── BLOCO 4: independente (só precisa do nome) → roda em PARALELO com a
  // cadeia B1→B2→B3. Não tem progresso granular; é rápido e fica "escondido"
  // atrás da cadeia.
  const b4Promise = plano.internacional
    ? runBlock4(
        inv.nome,
        { opensanctions: plano.opensanctions, companiesHouse: plano.companiesHouse, icij: plano.icij },
        logger,
      )
    : Promise.resolve(null)

  // ── BLOCO 1: Empresas (base — sempre roda) ──
  let b1: Block1Result | null = null
  try {
    await investigacoesRepo.setProgresso(inv.id, {
      bloco_atual: 'block1', etapa: 'Identificando sociedades do alvo', atual: 0, total: 1, eta_ms: null,
    })
    const b1Inicio = Date.now()
    b1 = await runBlock1(
      inv.nome,
      inv.cpf,
      async (atual, total) => {
        const elapsed = Date.now() - b1Inicio
        const eta_ms = atual > 0 && atual < total ? Math.round((elapsed / atual) * (total - atual)) : null
        await investigacoesRepo.setProgresso(inv.id, {
          bloco_atual: 'block1', etapa: `Empresas do alvo (${atual}/${total})`, atual, total: Math.max(total, 1), eta_ms,
        })
      },
      logger,
    )
    await empresasRepo.bulkInsert(inv.id, b1.empresas)
    await investigacoesRepo.finalizeBlock1(inv.id, {
      uuid: b1.uuid, cpfMasked: b1.cpfMasked, capitalTotal: b1.totalCapital, warnings: b1.warnings ?? [],
    })
    logger.info(`#${inv.id} bloco1 ok — ${b1.empresas.length} empresas`)
  } catch (err) {
    falhas.push({ bloco: 'block1', msg: errMsg(err) })
    logger.error(`#${inv.id} bloco1 falhou — ${errMsg(err)}`)
  }

  // ── BLOCO 2: Processos (depende do B1) ──
  let b2: Block2Result | null = null
  if (plano.processos && b1) {
    try {
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block2', etapa: 'Preparando consultas', atual: 0, total: 1, eta_ms: null,
      })
      const empresasNomes = b1.empresas
        .map((e) => e.nome)
        .filter((n): n is string => typeof n === 'string' && n.length > 0)
      b2 = await runBlock2(
        {
          nome: inv.nome,
          cpf: inv.cpf,
          empresas: empresasNomes,
          cpfParcial: inv.cpf.replace(/\D/g, '').padStart(11, '0').slice(3, 9),
        },
        async (info) => {
          await investigacoesRepo.setProgresso(inv.id, {
            bloco_atual: 'block2', etapa: info.etapa, atual: info.atual, total: info.total, eta_ms: info.etaMs,
          })
        },
        logger,
      )
      await processosRepo.bulkInsert(inv.id, b2.processos)
      await processosRepo.bulkInsertEmpresasVinculadas(inv.id, b2.empresasVinculadas)
      await processosRepo.bulkInsertAdvogados(inv.id, b2.advogados)
      await investigacoesRepo.finalizePjeCount(inv.id, b2.count)
      logger.info(`#${inv.id} bloco2 ok — ${b2.count} processos`)
    } catch (err) {
      falhas.push({ bloco: 'block2', msg: errMsg(err) })
      logger.error(`#${inv.id} bloco2 falhou — ${errMsg(err)}`)
    }
  }

  // ── BLOCO 3: Análise LLM (depende do B2) ──
  let analises: Map<string, string> | null = null
  if (plano.analiseLlm && b2) {
    try {
      await investigacoesRepo.setProgresso(inv.id, {
        bloco_atual: 'block3', etapa: 'Analisando comunicados (LLM)', atual: 0, total: 1, eta_ms: null,
      })
      const b3 = await runBlock3(b2.processos, logger, async (atual, total) => {
        await investigacoesRepo.setProgresso(inv.id, {
          bloco_atual: 'block3', etapa: `Analisando processos (${atual}/${total})`, atual, total, eta_ms: null,
        })
      })
      analises = b3.analises
      if (analises.size > 0) await processosRepo.updateAnaliseLlm(inv.id, analises)
      logger.info(`#${inv.id} bloco3 ok — ${analises.size} análises`)
    } catch (err) {
      falhas.push({ bloco: 'block3', msg: errMsg(err) })
      logger.error(`#${inv.id} bloco3 falhou — ${errMsg(err)}`)
    }
  }

  // ── Aguarda o BLOCO 4 (já estava rodando em paralelo) ──
  let sancoes: Sancao[] = []
  let empresasExterior: EmpresaExterior[] = []
  let offshore: VinculoOffshore[] = []
  if (plano.internacional) {
    await investigacoesRepo.setProgresso(inv.id, {
      bloco_atual: 'block4', etapa: 'Buscas internacionais', atual: 0, total: 1, eta_ms: null,
    })
    try {
      const b4 = await b4Promise
      if (b4) {
        sancoes = b4.sancoes
        empresasExterior = b4.empresasExterior
        offshore = b4.offshore
        if (sancoes.length > 0) await internacionalRepo.insertSancoes(inv.id, sancoes)
        if (empresasExterior.length > 0) await internacionalRepo.insertEmpresasExterior(inv.id, empresasExterior)
        if (offshore.length > 0) await internacionalRepo.insertOffshore(inv.id, offshore)
        // Registra falha sempre que QUALQUER fonte solicitada falhar — mesmo que
        // a outra tenha retornado dados. Caso contrário, uma fonte caída fica
        // invisível e a investigação seria finalizada como 'concluido'.
        if (b4.fontesFalhas.length > 0) {
          const detalhe = b4.fontesFalhas.map((f) => `${f.fonte}: ${f.msg}`).join('; ')
          falhas.push({ bloco: 'block4', msg: `fontes internacionais com falha — ${detalhe}` })
        }
        logger.info(`#${inv.id} bloco4 ok — ${sancoes.length} sanção(ões), ${empresasExterior.length} sociedade(s) ext`)
      }
    } catch (err) {
      falhas.push({ bloco: 'block4', msg: errMsg(err) })
      logger.error(`#${inv.id} bloco4 falhou — ${errMsg(err)}`)
    }
  } else {
    // Garante que a promise não vire unhandled rejection quando o plano não usa B4.
    await b4Promise.catch(() => null)
  }

  // ── RELATÓRIO (sempre gera com o que conseguiu) ──
  // Passa plano + falhas para o gerador distinguir "não executado" de
  // "nada encontrado" em blocos pulados/falhos.
  const md = generateReport(inv.nome, inv.cpf, b1 ?? EMPTY_B1, b2 ?? EMPTY_B2, analises, { sancoes, empresasExterior, offshore }, { plano, falhas })
  await relatoriosRepo.upsert(inv.id, md)

  // ── STATUS FINAL ──
  // erro: nada produzido. parcial: algo falhou mas houve resultado. concluido: tudo ok.
  const algumSucesso = b1 !== null || sancoes.length > 0 || empresasExterior.length > 0 || offshore.length > 0
  const status = falhas.length === 0 ? 'concluido' : algumSucesso ? 'concluido_parcial' : 'erro'
  await investigacoesRepo.finalizeExecucao(inv.id, status, falhas)
  logger.info(`#${inv.id} ${status}${falhas.length ? ` (falhas: ${falhas.map((f) => f.bloco).join(', ')})` : ''}`)
}

/**
 * Marca investigações que ficaram em 'rodando' (servidor morreu no meio)
 * como 'erro'. Chamado no boot do servidor.
 */
export async function reapOrphanedRuns(): Promise<void> {
  await investigacoesRepo.reapOrphaned()
}
