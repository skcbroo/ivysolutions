import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IcijResult, IcijDataset } from '../src/apis/offshoreleaks.js'

const { reconcileMock, getConnectionsMock } = vi.hoisted(() => ({
  reconcileMock: vi.fn(),
  getConnectionsMock: vi.fn(),
}))
vi.mock('../src/apis/offshoreleaks.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/offshoreleaks.js')>('../src/apis/offshoreleaks.js')
  return { ...actual, reconcile: reconcileMock, getConnections: getConnectionsMock }
})

// OpenSanctions e Companies House desligados nesses testes — só ICIJ.
const { matchPersonMock } = vi.hoisted(() => ({ matchPersonMock: vi.fn() }))
vi.mock('../src/apis/opensanctions.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/opensanctions.js')>('../src/apis/opensanctions.js')
  return { ...actual, matchPerson: matchPersonMock }
})

import { runBlock4 } from '../src/blocks/block4.js'

const silentLogger = { info: () => {}, warn: () => {} }

const hit = (over: Partial<IcijResult> = {}): IcijResult => ({
  id: 'NK-1',
  name: 'Sidnei Piva',
  score: 80,
  match: true,
  types: ['Officer'],
  dataset: 'panama-papers' as IcijDataset,
  ...over,
})

const ICIJ_OFF = { opensanctions: false, companiesHouse: false, icij: true }

beforeEach(() => {
  reconcileMock.mockReset()
  reconcileMock.mockResolvedValue([]) // datasets sem resultado por padrão
  getConnectionsMock.mockReset()
  getConnectionsMock.mockResolvedValue([]) // sem enriquecimento por padrão
})
afterEach(() => vi.clearAllMocks())

describe('runBlock4 — ICIJ Offshore Leaks', () => {
  it('mapeia hit com match=true para VinculoOffshore', async () => {
    reconcileMock.mockResolvedValueOnce([hit()]) // 1º dataset retorna; demais []
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(1)
    expect(r.offshore[0]).toMatchObject({
      entidade: 'Sidnei Piva',
      tipo: 'Pessoa (officer)', // normalizado PT-BR
      dataset: 'panama-papers',
      match: true,
      url: 'https://offshoreleaks.icij.org/nodes/NK-1',
    })
    expect(r.erros).toBe(0)
  })

  it('enriquece o vínculo com as conexões do grafo (entidade/endereço)', async () => {
    reconcileMock.mockResolvedValueOnce([hit()])
    getConnectionsMock.mockResolvedValueOnce([
      {
        id: '10147848',
        categoria: 'Entity',
        nome: 'SSG International Holdings Ltd.',
        jurisdicao: 'British Virgin Islands',
        endereco: 'BARBOSA LEGAL 407 LINCOLN ROAD, MIAMI BEACH, FL',
        status: 'Defaulted',
        incorporacao: '17-JUL-2012',
        url: 'https://offshoreleaks.icij.org/nodes/10147848',
      },
    ])
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(getConnectionsMock).toHaveBeenCalledWith('NK-1')
    expect(r.offshore[0].conexoes).toHaveLength(1)
    expect(r.offshore[0].conexoes[0]).toMatchObject({
      categoria: 'Entity',
      nome: 'SSG International Holdings Ltd.',
      jurisdicao: 'British Virgin Islands',
    })
  })

  it('falha ao buscar conexões não derruba o vínculo (best-effort)', async () => {
    reconcileMock.mockResolvedValueOnce([hit()])
    getConnectionsMock.mockRejectedValueOnce(new Error('grafo 500'))
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(1)
    expect(r.offshore[0].conexoes).toEqual([])
    expect(r.erros).toBe(0)
  })

  it('descarta hit sem match cujo nome não bate (homônimo frouxo)', async () => {
    reconcileMock.mockResolvedValueOnce([hit({ match: false, name: 'OUTRA PESSOA QUALQUER' })])
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(0)
  })

  it('mantém hit sem match quando o nome contém os tokens do alvo', async () => {
    reconcileMock.mockResolvedValueOnce([hit({ match: false, name: 'SIDNEI PIVA DE JESUS' })])
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(1)
  })

  it('tolera falha pontual de um dataset se outro responde (não conta como falha de fonte)', async () => {
    reconcileMock.mockReset()
    reconcileMock
      .mockRejectedValueOnce(new Error('panama down')) // dataset 1 falha
      .mockResolvedValueOnce([hit({ dataset: 'pandora-papers' as IcijDataset })]) // dataset 2 ok
      .mockResolvedValue([]) // demais vazios
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(1)
    expect(r.erros).toBe(0)
    expect(r.fontesFalhas).toEqual([])
  })

  it('conta falha da fonte ICIJ quando TODOS os datasets falham', async () => {
    reconcileMock.mockReset()
    reconcileMock.mockRejectedValue(new Error('icij down'))
    const r = await runBlock4('Sidnei Piva', ICIJ_OFF, silentLogger)
    expect(r.offshore).toHaveLength(0)
    expect(r.erros).toBe(1)
    expect(r.fontesFalhas).toEqual([{ fonte: 'ICIJ Offshore Leaks', msg: expect.stringContaining('icij down') }])
  })
})
