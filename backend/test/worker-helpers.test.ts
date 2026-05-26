import { describe, expect, it } from 'vitest'
import { toDate } from '../src/worker.js'

describe('toDate — coerção PT/ISO para Postgres', () => {
  it('ISO YYYY-MM-DD passa direto', () => {
    expect(toDate('2024-05-15')).toBe('2024-05-15')
    expect(toDate('2024-05-15T12:34:56Z')).toBe('2024-05-15')
  })
  it('DD/MM/YYYY vira ISO', () => {
    expect(toDate('15/05/2024')).toBe('2024-05-15')
    expect(toDate('01/01/2000')).toBe('2000-01-01')
  })
  it('null/undefined/lixo → null', () => {
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate('Maio 2024')).toBeNull()
  })
})
