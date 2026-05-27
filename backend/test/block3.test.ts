import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Block2Processo } from '../src/blocks/block2.js'

// vi.mock é hoisted pro topo, então a função mock precisa ser criada via
// vi.hoisted pra estar disponível dentro do factory.
const { callClaudeMock } = vi.hoisted(() => ({ callClaudeMock: vi.fn() }))
vi.mock('../src/apis/claude.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/claude.js')>('../src/apis/claude.js')
  return {
    ...actual,
    callClaude: callClaudeMock,
  }
})

import { runBlock3 } from '../src/blocks/block3.js'
import { ClaudeError, type ClaudeResponse } from '../src/apis/claude.js'

function mkResponse(text: string, usage: Partial<ClaudeResponse['usage']> = {}): ClaudeResponse {
  return {
    id: 'msg_x',
    model: 'claude-haiku-4-5',
    role: 'assistant',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 30,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      ...usage,
    },
  }
}

function mkProcesso(numero: string, comunicacoesCount = 1): Block2Processo {
  return {
    numero,
    tribunal: 'TJSP',
    orgao: '1ª Vara',
    classe: 'EXECUÇÃO FISCAL',
    tipo: null,
    polo: 'P',
    link: null,
    criminal: false,
    vinculo: 'pessoal',
    empresaVinculada: null,
    comunicacoes: Array.from({ length: comunicacoesCount }, (_, i) => ({
      data: `2024-01-${String(i + 1).padStart(2, '0')}`,
      tipo: 'Sentença',
      texto: `texto ${i + 1}`,
      link: null,
    })),
  }
}

const silentLogger = { info: () => {}, warn: () => {} }

beforeEach(() => {
  callClaudeMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('runBlock3', () => {
  it('retorna result vazio quando nenhum processo tem comunicacoes', async () => {
    const result = await runBlock3(
      [
        { ...mkProcesso('A'), comunicacoes: [] },
        { ...mkProcesso('B'), comunicacoes: [] },
      ],
      silentLogger,
    )
    expect(result.analises.size).toBe(0)
    expect(result.erros).toBe(0)
    expect(callClaudeMock).not.toHaveBeenCalled()
  })

  it('analisa cada processo com comunicacoes e popula o Map', async () => {
    callClaudeMock
      .mockResolvedValueOnce(mkResponse('penhora BACEN-JUD R$ 100k', { cache_creation_input_tokens: 500 }))
      .mockResolvedValueOnce(mkResponse('Sem dados patrimoniais relevantes.', { cache_read_input_tokens: 500 }))

    const processos = [mkProcesso('P1'), mkProcesso('P2')]
    const result = await runBlock3(processos, silentLogger)

    expect(result.analises.size).toBe(2)
    expect(result.analises.get('P1')).toContain('penhora')
    expect(result.analises.get('P2')).toContain('Sem dados')
    expect(result.erros).toBe(0)
    expect(result.cacheWrites).toBe(500)
    expect(result.cacheReads).toBe(500)
  })

  it('conta erros e segue quando uma chamada do Claude falha (não trava o loop)', async () => {
    callClaudeMock
      .mockResolvedValueOnce(mkResponse('analise A'))
      .mockRejectedValueOnce(new ClaudeError(429, null, 'rate limit'))
      .mockResolvedValueOnce(mkResponse('analise C'))

    const processos = [mkProcesso('A'), mkProcesso('B'), mkProcesso('C')]
    const result = await runBlock3(processos, silentLogger)

    expect(result.analises.size).toBe(2)
    expect(result.analises.has('A')).toBe(true)
    expect(result.analises.has('B')).toBe(false)
    expect(result.analises.has('C')).toBe(true)
    expect(result.erros).toBe(1)
  })

  it('descarta resposta vazia (não adiciona ao Map)', async () => {
    callClaudeMock.mockResolvedValueOnce(mkResponse(''))

    const result = await runBlock3([mkProcesso('A')], silentLogger)
    expect(result.analises.size).toBe(0)
    expect(result.erros).toBe(0)
  })

  it('passa system prompt com cache_control no body da chamada', async () => {
    callClaudeMock.mockResolvedValueOnce(mkResponse('ok'))

    await runBlock3([mkProcesso('A')], silentLogger)

    expect(callClaudeMock).toHaveBeenCalledOnce()
    const req = callClaudeMock.mock.calls[0][0]
    expect(req.system).toBeDefined()
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(req.temperature).toBe(0)
    expect(req.messages[0].role).toBe('user')
    expect(req.messages[0].content).toContain('Processo: A')
  })

  it('chama onProgress (i+1, total) por processo elegível', async () => {
    callClaudeMock.mockResolvedValue(mkResponse('x'))
    const onProgress = vi.fn(async () => {})
    const processos = [mkProcesso('A'), mkProcesso('B'), mkProcesso('C')]
    await runBlock3(processos, silentLogger, onProgress)
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3)
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3)
  })
})
