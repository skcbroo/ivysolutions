import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Habilita o Companies House mockando a config com a key presente.
vi.mock('../src/config.js', () => ({ config: { UK_COMPANIES_API_KEY: 'k' }, isProd: false }))

const { matchPersonMock } = vi.hoisted(() => ({ matchPersonMock: vi.fn() }))
vi.mock('../src/apis/opensanctions.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/apis/opensanctions.js')>('../src/apis/opensanctions.js')
  return { ...actual, matchPerson: matchPersonMock }
})

const { searchOfficersMock, getAppointmentsMock } = vi.hoisted(() => ({
  searchOfficersMock: vi.fn(),
  getAppointmentsMock: vi.fn(),
}))
vi.mock('../src/apis/ukcompanies.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/apis/ukcompanies.js')>('../src/apis/ukcompanies.js')
  return { ...actual, searchOfficers: searchOfficersMock, getOfficerAppointments: getAppointmentsMock }
})

import { runBlock4 } from '../src/blocks/block4.js'

const silentLogger = { info: () => {}, warn: () => {} }

beforeEach(() => {
  matchPersonMock.mockReset()
  searchOfficersMock.mockReset()
  getAppointmentsMock.mockReset()
  matchPersonMock.mockResolvedValue([]) // sem sanções
})
afterEach(() => vi.clearAllMocks())

describe('runBlock4 — Companies House', () => {
  it('mapeia cada nomeação como empresa no exterior (com datas)', async () => {
    searchOfficersMock.mockResolvedValueOnce([
      { title: 'SIDNEI PIVA DE JESUS', links: { self: '/officers/abc/appointments' } },
    ])
    getAppointmentsMock.mockResolvedValueOnce([
      {
        appointed_to: { company_name: 'ACME LTD', company_number: '123' },
        officer_role: 'director',
        appointed_on: '2022-03-03',
        resigned_on: null,
      },
    ])

    const r = await runBlock4('Sidnei Piva de Jesus', silentLogger)
    expect(r.empresasExterior).toHaveLength(1)
    const e = r.empresasExterior[0]
    expect(e.empresa).toBe('ACME LTD')
    expect(e.numero).toBe('123')
    expect(e.cargo).toBe('director')
    expect(e.entrada).toBe('2022-03-03')
    expect(e.saida).toBeNull()
    expect(e.jurisdicao).toBe('GB')
    expect(e.url).toBe('https://find-and-update.company-information.service.gov.uk/company/123')
  })

  it('descarta officers que não batem com o nome (homônimo frouxo)', async () => {
    searchOfficersMock.mockResolvedValueOnce([
      { title: 'OUTRA PESSOA QUALQUER', links: { self: '/officers/z/appointments' } },
    ])
    const r = await runBlock4('Sidnei Piva de Jesus', silentLogger)
    expect(r.empresasExterior).toHaveLength(0)
    expect(getAppointmentsMock).not.toHaveBeenCalled()
  })

  it('uma fonte falhando não derruba a outra', async () => {
    searchOfficersMock.mockRejectedValueOnce(new Error('uk down'))
    const r = await runBlock4('Sidnei', silentLogger)
    expect(r.erros).toBe(1)
    expect(r.empresasExterior).toEqual([])
  })
})
