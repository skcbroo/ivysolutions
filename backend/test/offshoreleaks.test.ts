import { afterEach, describe, expect, it, vi } from 'vitest'

const { httpJsonMock } = vi.hoisted(() => ({ httpJsonMock: vi.fn() }))
vi.mock('../src/apis/http.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/http.js')>('../src/apis/http.js')
  return { ...actual, httpJson: httpJsonMock }
})

import { reconcile, nodeUrl, OffshoreLeaksError } from '../src/apis/offshoreleaks.js'

afterEach(() => vi.clearAllMocks())

describe('offshoreleaks.reconcile', () => {
  it('mapeia resultados (HTTP 201) e normaliza o campo `types` (plural, como a API real)', async () => {
    httpJsonMock.mockResolvedValueOnce({
      status: 201, // a API do ICIJ responde 201 no sucesso
      data: {
        result: [
          {
            id: 'abc',
            name: 'Fulano',
            score: 22.2,
            match: false,
            types: [{ id: 'https://offshoreleaks.icij.org/schema/oldb/officer', name: 'Officer' }],
          },
        ],
      },
      text: '',
    })
    const r = await reconcile('Fulano', 'panama-papers')
    expect(r).toEqual([
      { id: 'abc', name: 'Fulano', score: 22.2, match: false, types: ['Officer'], dataset: 'panama-papers' },
    ])
  })

  it('descarta entradas sem id/name e usa defaults de score/match', async () => {
    httpJsonMock.mockResolvedValueOnce({
      status: 201,
      data: { result: [{ name: 'sem id' }, { id: 'x', name: 'Beltrano' }] },
      text: '',
    })
    const r = await reconcile('Beltrano', 'offshore-leaks')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'x', name: 'Beltrano', score: 0, match: false, types: [] })
  })

  it('lança OffshoreLeaksError em resposta não-200', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 503, data: null, text: 'unavailable' })
    await expect(reconcile('Fulano', 'pandora-papers')).rejects.toBeInstanceOf(OffshoreLeaksError)
  })

  it('nodeUrl monta a URL pública do nó', () => {
    expect(nodeUrl('abc')).toBe('https://offshoreleaks.icij.org/nodes/abc')
  })
})
