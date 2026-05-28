import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { httpJsonMock } = vi.hoisted(() => ({ httpJsonMock: vi.fn() }))
vi.mock('../src/apis/http.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/http.js')>('../src/apis/http.js')
  return { ...actual, httpJson: httpJsonMock }
})

import { matchPerson, OpenSanctionsError } from '../src/apis/opensanctions.js'

function ok(results: unknown[]) {
  return {
    status: 200,
    data: { responses: { q1: { status: 200, results } } },
    text: '',
  }
}

beforeEach(() => httpJsonMock.mockReset())
afterEach(() => vi.clearAllMocks())

describe('matchPerson', () => {
  it('retorna os results da resposta q1', async () => {
    httpJsonMock.mockResolvedValueOnce(
      ok([{ id: 'x', caption: 'John Doe', schema: 'Person', score: 0.9, match: true, datasets: ['us_ofac_sdn'], properties: {} }]),
    )
    const out = await matchPerson('John Doe', { apiKey: 'k' })
    expect(out).toHaveLength(1)
    expect(out[0].caption).toBe('John Doe')
  })

  it('envia Authorization quando há apiKey e omite quando não há', async () => {
    httpJsonMock.mockResolvedValue(ok([]))
    await matchPerson('A', { apiKey: 'segredo' })
    expect(httpJsonMock.mock.calls[0][1].headers.authorization).toBe('ApiKey segredo')

    await matchPerson('A', { apiKey: '' })
    expect(httpJsonMock.mock.calls[1][1].headers.authorization).toBeUndefined()
  })

  it('manda schema Person com o nome no body', async () => {
    httpJsonMock.mockResolvedValueOnce(ok([]))
    await matchPerson('Sidnei Piva', { apiKey: 'k' })
    const body = JSON.parse(httpJsonMock.mock.calls[0][1].body)
    expect(body.queries.q1.schema).toBe('Person')
    expect(body.queries.q1.properties.name).toEqual(['Sidnei Piva'])
  })

  it('retorna [] quando não há results', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 200, data: { responses: { q1: {} } }, text: '' })
    expect(await matchPerson('A', { apiKey: 'k' })).toEqual([])
  })

  it('lança OpenSanctionsError em status != 200', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 401, data: { error: 'unauthorized' }, text: '' })
    await expect(matchPerson('A', { apiKey: 'k' })).rejects.toBeInstanceOf(OpenSanctionsError)
  })
})
