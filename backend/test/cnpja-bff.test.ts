import { describe, expect, it } from 'vitest'
import { extractCentral } from '../src/apis/cnpja-bff.js'

describe('extractCentral — 6 dígitos centrais do CPF', () => {
  it('extrai do formato ***XXXXXX**', () => {
    expect(extractCentral('***567398**')).toBe('567398')
  })
  it('retorna null para entrada inválida', () => {
    expect(extractCentral('123.456.789-10')).toBeNull()
    expect(extractCentral('')).toBeNull()
    expect(extractCentral(undefined)).toBeNull()
  })
  it('CPF puro com 11 dígitos slice 3..9 → centrais', () => {
    const cpf = '06256739809'
    const central = cpf.padStart(11, '0').slice(3, 9)
    expect(central).toBe('567398')
    expect(extractCentral('***567398**')).toBe(central)
  })
})
