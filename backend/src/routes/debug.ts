import type { FastifyInstance } from 'fastify'
import { httpJson } from '../apis/http.js'

/**
 * Endpoint temporário pra diagnosticar bloqueio de IP em APIs externas.
 * Sem auth (só faz GET em APIs públicas e devolve metadados).
 * Remover depois de fechar o caso.
 */
export async function debugRoutes(app: FastifyInstance) {
  app.get('/debug/comunica', async () => {
    return probe(
      'https://comunicaapi.pje.jus.br/api/v1/comunicacao?nomeParte=Bruno%20Ladeira%20Junqueira&itensPorPagina=100&pagina=1',
    )
  })

  app.get('/debug/bff-cnpja', async () => {
    return probe('https://bff.cnpja.com/search?query=Bruno%20Ladeira%20Junqueira')
  })

  app.get('/debug/brasilapi', async () => {
    return probe('https://brasilapi.com.br/api/cnpj/v1/43198710000180')
  })

  app.get('/debug/cnpja-open', async () => {
    return probe('https://open.cnpja.com/office/43198710000180')
  })
}

async function probe(url: string) {
  const t0 = Date.now()
  try {
    const { status, data, text } = await httpJson<unknown>(url, {
      retries: 0,
      timeoutMs: 15_000,
    })
    return {
      url,
      ok: status === 200,
      status,
      durationMs: Date.now() - t0,
      bodyLength: text.length,
      preview: text.slice(0, 300),
      itemsCount: countItems(data),
    }
  } catch (err) {
    return {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    }
  }
}

function countItems(data: unknown): number | null {
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items
    if (Array.isArray(items)) return items.length
  }
  if (data && typeof data === 'object' && 'records' in data) {
    const records = (data as { records?: unknown }).records
    if (Array.isArray(records)) return records.length
  }
  return null
}
