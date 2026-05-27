import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/middleware.js'
import { runWorker } from '../worker.js'
import { formatCpf } from '../utils/format.js'
import * as investigacoesRepo from '../repos/investigacoes.js'
import * as empresasRepo from '../repos/empresas.js'
import * as processosRepo from '../repos/processos.js'
import * as relatoriosRepo from '../repos/relatorios.js'

const CreateInput = z.object({
  nome: z.string().trim().min(3).max(120),
  cpf: z
    .string()
    .transform((s) => s.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')),
})

export async function investigacoesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.post('/investigacoes', async (request, reply) => {
    const parse = CreateInput.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: 'invalid_input', fields: parse.error.flatten().fieldErrors })
    }
    const { nome, cpf } = parse.data
    const userId = request.user?.userId ?? null

    const inv = await investigacoesRepo.create({ nome, cpf, createdBy: userId })

    // Fire-and-forget: erros marcam status='erro' no banco.
    runWorker(Number(inv.id)).catch(async (err) => {
      request.log.error(err, `worker falhou em #${inv.id}`)
      try {
        await investigacoesRepo.setStatus(
          Number(inv.id),
          'erro',
          (err as Error).message ?? 'erro desconhecido',
        )
      } catch (err2) {
        request.log.error(err2, 'falha ao registrar erro do worker')
      }
    })

    return reply.code(201).send({
      ...inv,
      cpf: formatCpf(inv.cpf),
    })
  })

  app.get('/investigacoes', async () => {
    const rows = await investigacoesRepo.listRecent(200)
    return rows.map((r) => ({ ...r, cpf: formatCpf(r.cpf) }))
  })

  app.get<{ Params: { id: string } }>('/investigacoes/:id/status', async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' })
    const status = await investigacoesRepo.findStatus(id)
    if (!status) return reply.code(404).send({ error: 'not_found' })
    return status
  })

  app.get<{ Params: { id: string } }>('/investigacoes/:id', async (request, reply) => {
    const id = Number(request.params.id)
    if (!Number.isFinite(id)) return reply.code(400).send({ error: 'invalid_id' })

    const investigacao = await investigacoesRepo.findById(id)
    if (!investigacao) return reply.code(404).send({ error: 'not_found' })

    const [empresas, processos, advogados, vinculadas, relatorio] = await Promise.all([
      empresasRepo.findByInvestigacao(id),
      processosRepo.findByInvestigacao(id),
      processosRepo.findAdvogados(id),
      processosRepo.findEmpresasVinculadas(id),
      relatoriosRepo.findByInvestigacao(id),
    ])

    return {
      ...investigacao,
      cpf: formatCpf(investigacao.cpf),
      empresas,
      processos,
      advogados,
      empresas_vinculadas: vinculadas,
      relatorio_md: relatorio?.conteudo_md ?? null,
      relatorio_gerado_em: relatorio?.gerado_em ?? null,
    }
  })
}
