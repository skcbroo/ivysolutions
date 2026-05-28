import { describe, expect, it } from 'vitest'
import { formatCpf, validateCpf } from '../src/utils/cpf'

describe('validateCpf', () => {
  it('aceita CPFs válidos (com e sem máscara)', () => {
    expect(validateCpf('529.982.247-25')).toBe(true)
    expect(validateCpf('52998224725')).toBe(true)
    expect(validateCpf('111.444.777-35')).toBe(true)
  })

  it('rejeita dígitos verificadores errados', () => {
    expect(validateCpf('529.982.247-24')).toBe(false)
    expect(validateCpf('11144477736')).toBe(false)
  })

  it('rejeita comprimento diferente de 11', () => {
    expect(validateCpf('123')).toBe(false)
    expect(validateCpf('5299822472')).toBe(false)
    expect(validateCpf('529982247250')).toBe(false)
  })

  it('rejeita sequências repetidas', () => {
    for (let n = 0; n <= 9; n++) {
      expect(validateCpf(String(n).repeat(11))).toBe(false)
    }
  })
})

describe('formatCpf', () => {
  it('formata progressivamente', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('529982')).toBe('529.982')
    expect(formatCpf('529982247')).toBe('529.982.247')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
  })

  it('descarta não-dígitos e excedente', () => {
    expect(formatCpf('529.982.247-25extra')).toBe('529.982.247-25')
  })
})
