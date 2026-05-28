import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenSanctionsResult } from '../src/apis/opensanctions.js'

const { matchPersonMock } = vi.hoisted(() => ({ matchPersonMock: vi.fn() }))
vi.mock('../src/apis/opensanctions.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/apis/opensanctions.js')>('../src/apis/opensanctions.js')
  return { ...actual, matchPerson: matchPersonMock }
})

import { runBlock4, MATCH_SCORE_THRESHOLD } from '../src/blocks/block4.js'

function mkResult(over: Partial<OpenSanctionsResult> = {}): OpenSanctionsResult {
  return {
    id: 'NK-abc',
    caption: 'Fulano',
    schema: 'Person',
    score: 0.9,
    match: true,
    datasets: ['us_ofac_sdn'],
    properties: { country: ['ru'], topics: ['sanction'], alias: ['F.'], birthDate: ['1970'] },
    ...over,
  }
}

const silentLogger = { info: () => {}, warn: () => {} }

beforeEach(() => matchPersonMock.mockReset())
afterEach(() => vi.clearAllMocks())

describe('runBlock4', () => {
  it('mapeia um hit do OpenSanctions com país/programa/alias/url', async () => {
    matchPersonMock.mockResolvedValueOnce([mkResult()])
    const r = await runBlock4('Fulano', silentLogger)
    expect(r.hits).toHaveLength(1)
    const h = r.hits[0]
    expect(h.fonte).toBe('opensanctions')
    expect(h.paises).toContain('ru')
    expect(h.programas).toEqual(expect.arrayContaining(['sanction']))
    expect(h.aliases).toContain('F.')
    expect(h.url).toBe('https://www.opensanctions.org/entities/NK-abc/')
    expect(r.erros).toBe(0)
  })

  it('filtra candidatos abaixo do corte e sem match', async () => {
    matchPersonMock.mockResolvedValueOnce([
      mkResult({ match: false, score: MATCH_SCORE_THRESHOLD - 0.1 }),
      mkResult({ id: 'B', match: false, score: MATCH_SCORE_THRESHOLD + 0.05 }),
      mkResult({ id: 'C', match: true, score: 0.1 }),
    ])
    const r = await runBlock4('Fulano', silentLogger)
    expect(r.hits.map((h) => h.url)).toEqual([
      'https://www.opensanctions.org/entities/B/',
      'https://www.opensanctions.org/entities/C/',
    ])
  })

  it('conta erro e não quebra quando a API falha', async () => {
    matchPersonMock.mockRejectedValueOnce(new Error('boom'))
    const r = await runBlock4('Fulano', silentLogger)
    expect(r.hits).toHaveLength(0)
    expect(r.erros).toBe(1)
  })

  it('chama onProgress no início e no fim', async () => {
    matchPersonMock.mockResolvedValueOnce([])
    const onProgress = vi.fn(async () => {})
    await runBlock4('Fulano', silentLogger, onProgress)
    expect(onProgress).toHaveBeenCalledWith(0, 1)
    expect(onProgress).toHaveBeenCalledWith(1, 1)
  })
})
