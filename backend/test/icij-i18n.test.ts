import { describe, expect, it } from 'vitest'
import { categoriaPt, statusPt, jurisdicaoPt, dataPt } from '../src/apis/icij-i18n.js'

describe('icij-i18n', () => {
  it('traduz categorias', () => {
    expect(categoriaPt('Entity')).toBe('Empresa offshore')
    expect(categoriaPt('Officer')).toBe('Pessoa (officer)')
    expect(categoriaPt('Address')).toBe('Endereço')
  })

  it('traduz status (case-insensitive)', () => {
    expect(statusPt('Defaulted')).toBe('Inadimplente')
    expect(statusPt('ACTIVE')).toBe('Ativa')
  })

  it('traduz jurisdição por código e por nome', () => {
    expect(jurisdicaoPt('BVI')).toBe('Ilhas Virgens Britânicas')
    expect(jurisdicaoPt('British Virgin Islands')).toBe('Ilhas Virgens Britânicas')
    expect(jurisdicaoPt('Panama')).toBe('Panamá')
  })

  it('formata data DD-MMM-AAAA → DD/MM/AAAA', () => {
    expect(dataPt('17-JUL-2012')).toBe('17/07/2012')
    expect(dataPt('5-JAN-2009')).toBe('05/01/2009')
  })

  it('fallback ao original quando não mapeado / nulo', () => {
    expect(categoriaPt('Weird')).toBe('Weird')
    expect(jurisdicaoPt('Atlantis')).toBe('Atlantis')
    expect(dataPt('2012')).toBe('2012')
    expect(statusPt(null)).toBeNull()
  })
})
