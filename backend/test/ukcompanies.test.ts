import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { httpJsonMock } = vi.hoisted(() => ({ httpJsonMock: vi.fn() }))
vi.mock('../src/apis/http.js', async () => {
  const actual = await vi.importActual<typeof import('../src/apis/http.js')>('../src/apis/http.js')
  return { ...actual, httpJson: httpJsonMock }
})

import { searchOfficers, getOfficerAppointments, UkCompaniesError } from '../src/apis/ukcompanies.js'

const ok = (data: unknown) => ({ status: 200, data, text: '' })

beforeEach(() => httpJsonMock.mockReset())
afterEach(() => vi.clearAllMocks())

describe('searchOfficers', () => {
  it('retorna os items e usa Basic auth com a key', async () => {
    httpJsonMock.mockResolvedValueOnce(ok({ items: [{ title: 'John DOE', links: { self: '/officers/x/appointments' } }] }))
    const out = await searchOfficers('John Doe', { apiKey: 'k' })
    expect(out).toHaveLength(1)
    const expected = 'Basic ' + Buffer.from('k:').toString('base64')
    expect(httpJsonMock.mock.calls[0][1].headers.authorization).toBe(expected)
  })

  it('lança UkCompaniesError sem apiKey', async () => {
    await expect(searchOfficers('A', { apiKey: '' })).rejects.toBeInstanceOf(UkCompaniesError)
  })

  it('lança UkCompaniesError em status != 200', async () => {
    httpJsonMock.mockResolvedValueOnce({ status: 401, data: null, text: 'Invalid Authorization' })
    await expect(searchOfficers('A', { apiKey: 'k' })).rejects.toBeInstanceOf(UkCompaniesError)
  })

  it('retorna [] quando não há items', async () => {
    httpJsonMock.mockResolvedValueOnce(ok({}))
    expect(await searchOfficers('A', { apiKey: 'k' })).toEqual([])
  })
})

describe('getOfficerAppointments', () => {
  it('retorna os items das nomeações', async () => {
    httpJsonMock.mockResolvedValueOnce(
      ok({ items: [{ appointed_to: { company_name: 'ACME', company_number: '123' }, officer_role: 'director' }] }),
    )
    const out = await getOfficerAppointments('/officers/x/appointments', { apiKey: 'k' })
    expect(out[0].appointed_to?.company_name).toBe('ACME')
  })
})
