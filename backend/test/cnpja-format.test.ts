import { describe, expect, it } from 'vitest'
import { formatPhone, formatPhoneFromBrasilApi } from '../src/apis/cnpja.js'

describe('formatPhone (CNPJa Open: area + number separados)', () => {
  it('fixo 8 dígitos → (DD) XXXX-XXXX', () => {
    expect(formatPhone('11', '23401623')).toBe('(11) 2340-1623')
  })
  it('celular 9 dígitos → (DD) XXXXX-XXXX', () => {
    expect(formatPhone('11', '987654321')).toBe('(11) 98765-4321')
  })
  it('aceita máscara residual', () => {
    expect(formatPhone(' 11', '2340-1623')).toBe('(11) 2340-1623')
  })
  it('retorna null quando area ausente', () => {
    expect(formatPhone(undefined, '23401623')).toBeNull()
  })
  it('retorna null quando vazios', () => {
    expect(formatPhone('', '')).toBeNull()
  })
})

describe('formatPhoneFromBrasilApi (string concat sem máscara)', () => {
  it('10 dígitos → fixo formatado', () => {
    expect(formatPhoneFromBrasilApi('1123401623')).toBe('(11) 2340-1623')
  })
  it('11 dígitos → celular formatado', () => {
    expect(formatPhoneFromBrasilApi('11987654321')).toBe('(11) 98765-4321')
  })
  it('rejeita < 10 dígitos', () => {
    expect(formatPhoneFromBrasilApi('123456789')).toBeNull()
  })
  it('null/empty → null', () => {
    expect(formatPhoneFromBrasilApi(null)).toBeNull()
    expect(formatPhoneFromBrasilApi('')).toBeNull()
  })
})
