import { afterEach, describe, expect, it, vi } from 'vitest'

const { httpJsonMock } = vi.hoisted(() => ({ httpJsonMock: vi.fn() }))
vi.mock('../src/apis/http.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/http.js')>('../src/apis/http.js')
  return { ...actual, httpJson: httpJsonMock }
})

import { reconcile, getConnections, nodeUrl, OffshoreLeaksError } from '../src/apis/offshoreleaks.js'

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

  it('por padrão NÃO envia `type` (busca todas as categorias)', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 201, data: { result: [] }, text: '' })
    await reconcile('Fulano', 'panama-papers')
    const body = JSON.parse(httpJsonMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('type')
    expect(body).toMatchObject({ query: 'Fulano', limit: 10 })
  })

  it('envia `type` quando especificado', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 201, data: { result: [] }, text: '' })
    await reconcile('Fulano', 'panama-papers', { type: 'Entity', limit: 3 })
    const body = JSON.parse(httpJsonMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ query: 'Fulano', type: 'Entity', limit: 3 })
  })

  it('nodeUrl monta a URL pública do nó', () => {
    expect(nodeUrl('abc')).toBe('https://offshoreleaks.icij.org/nodes/abc')
  })

  it('getConnections parseia o grafo /nodes/{id}.json (entidade + endereço)', async () => {
    httpJsonMock.mockResolvedValueOnce({
      status: 200,
      data: [
        {
          id: 10147848,
          data: {
            categories: ['Entity'],
            properties: {
              name: 'SSG International Holdings Ltd.',
              jurisdiction: 'BVI',
              jurisdiction_description: 'British Virgin Islands',
              address: 'BARBOSA LEGAL 407 LINCOLN ROAD, MIAMI BEACH, FL',
              incorporation_date: '17-JUL-2012',
              status: 'Defaulted',
            },
          },
        },
        {
          id: 14007981,
          data: { categories: ['Address'], properties: { address: '2000 Ponce De Leon Blvd, Coral Gables, FL' } },
        },
      ],
      text: '',
    })
    const c = await getConnections('12103204')
    expect(c).toHaveLength(2)
    expect(c[0]).toMatchObject({
      id: '10147848',
      categoria: 'Entity',
      nome: 'SSG International Holdings Ltd.',
      jurisdicao: 'British Virgin Islands',
      incorporacao: '17-JUL-2012',
      status: 'Defaulted',
      url: 'https://offshoreleaks.icij.org/nodes/10147848',
    })
    expect(c[1]).toMatchObject({ categoria: 'Address', nome: '2000 Ponce De Leon Blvd, Coral Gables, FL' })
  })

  it('getConnections devolve [] em erro (best-effort)', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 500, data: null, text: 'err' })
    expect(await getConnections('x')).toEqual([])
  })
})
